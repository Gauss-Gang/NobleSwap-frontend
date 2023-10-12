/* prettier-ignore */
import { ChainId, CurrencyAmount, JSBI, Token, Trade } from '@uniswap/sdk';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ArrowDown } from 'react-feather';
import { Text } from 'rebass';
import { ThemeContext } from 'styled-components';
import AddressInputPanel from '../../components/AddressInputPanel';
import { ButtonError, ButtonPrimary, ButtonConfirmed, ButtonSlanted } from '../../components/Button';
import Card, { GreyCard } from '../../components/Card';
import Column, { AutoColumn } from '../../components/Column';
import ConfirmSwapModal from '../../components/swap/ConfirmSwapModal';
import { CurrencyInputPanelGud } from '../../components/CurrencyInputPanel';
import { SwapPoolTabs } from '../../components/NavigationTabs';
import { AutoRow, RowBetween } from '../../components/Row';
import confirmPriceImpactWithoutFee from '../../components/swap/confirmPriceImpactWithoutFee';
import { ArrowWrapper, BottomGrouping, SwapCallbackError, Wrapper } from '../../components/swap/styleds';
import TradePrice from '../../components/swap/TradePrice';
import TokenWarningModal from '../../components/TokenWarningModal';
import ProgressSteps from '../../components/ProgressSteps';
import { GudHeader } from '../../components/swap/SwapHeader';
import AdvancedSwapDetailsDropdown from '../../components/swap/AdvancedSwapDetailsDropdown';
import { useActiveWeb3React } from '../../hooks';
import { useCurrency, useAllTokens } from '../../hooks/Tokens';
import { ApprovalState, useApproveCallbackFromTrade } from '../../hooks/useApproveCallback';
import { useSwapCallback } from '../../hooks/useSwapCallback';
import useWrapCallback, { WrapType } from '../../hooks/useWrapCallback';
import { useToggleSettingsMenu, useWalletModalToggle } from '../../state/application/hooks';
import { Field } from '../../state/swap/actions';
import {
  useDefaultsFromURLSearch,
  useDerivedSwapInfo,
  useSwapActionHandlers,
  useSwapState,
} from '../../state/swap/hooks';
import { useExpertModeManager, useUserSlippageTolerance, useUserSingleHopOnly } from '../../state/user/hooks';
import { LinkStyledButton, TYPE } from '../../theme';
import { maxAmountSpend } from '../../utils/maxAmountSpend';
import { computeTradePriceBreakdown, warningSeverity } from '../../utils/prices';
import AppBody from '../AppBody';
import { ClickableText } from '../Pool/styleds';
import Loader from '../../components/Loader';
import { useLocation } from 'react-router-dom';
import { useWeb3React } from '@web3-react/core';
import { Contract } from 'ethers';
import { parseUnits } from '@ethersproject/units';

const ERC20_ABI = [
  {
    constant: true,
    inputs: [
      {
        name: '_owner',
        type: 'address',
      },
      {
        name: '_spender',
        type: 'address',
      },
    ],
    name: 'allowance',
    outputs: [
      {
        name: 'remaining',
        type: 'uint256',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      {
        name: 'spender',
        type: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
      },
    ],
    name: 'approve',
    outputs: [
      {
        name: '',
        type: 'bool',
      },
    ],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

const TRANSFER_ABI = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_recipient',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_amountIn',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: '_source',
        type: 'address',
      },
      {
        internalType: 'bool',
        name: '_express',
        type: 'bool',
      },
    ],
    name: 'transfer',
    outputs: [
      {
        internalType: 'uint256',
        name: '_txId',
        type: 'uint256',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
];

const TOKEN_ADDRESS = '0x607D772B71FF8480a6A0D9b148D951AEdc990769';
const SPENDER_ADDRESS = '0x771a7B1148420590774c5692F34cce3dC22e84f5';
const CONTRACT_ADDRESS = '0x771a7B1148420590774c5692F34cce3dC22e84f5';

export default function Gud() {
  const loadedUrlParams = useDefaultsFromURLSearch();

  const [expressMode, setExpressMode] = useState<boolean>(false);
  const [allowance, setAllowance] = useState<string>('0');
  const [balance, setBalance] = useState('0');
  const location = useLocation();
  const { chainId, library } = useWeb3React();

  // token warning stuff
  const [loadedInputCurrency, loadedOutputCurrency] = [
    useCurrency(loadedUrlParams?.inputCurrencyId),
    useCurrency(loadedUrlParams?.outputCurrencyId),
  ];
  const [dismissTokenWarning, setDismissTokenWarning] = useState<boolean>(false);
  const urlLoadedTokens: Token[] = useMemo(
    () => [loadedInputCurrency, loadedOutputCurrency]?.filter((c): c is Token => c instanceof Token) ?? [],
    [loadedInputCurrency, loadedOutputCurrency]
  );
  const handleConfirmTokenWarning = useCallback(() => {
    setDismissTokenWarning(true);
  }, []);

  // dismiss warning if all imported tokens are in active lists
  const defaultTokens = useAllTokens();
  const importTokensNotInDefault =
    urlLoadedTokens &&
    urlLoadedTokens.filter((token: Token) => {
      return !Boolean(token.address in defaultTokens);
    });

  const { account } = useActiveWeb3React();
  const theme = useContext(ThemeContext);

  // toggle wallet when disconnected
  const toggleWalletModal = useWalletModalToggle();

  // for expert mode
  const toggleSettings = useToggleSettingsMenu();
  const [isExpertMode] = useExpertModeManager();

  // get custom setting values for user
  const [allowedSlippage] = useUserSlippageTolerance();

  // swap state
  const { independentField, typedValue, recipient } = useSwapState();
  const { v2Trade, currencyBalances, parsedAmount, currencies, inputError: swapInputError } = useDerivedSwapInfo();
  const {
    wrapType,
    execute: onWrap,
    inputError: wrapInputError,
  } = useWrapCallback(currencies[Field.INPUT], currencies[Field.OUTPUT], typedValue);

  const showWrap: boolean = wrapType !== WrapType.NOT_APPLICABLE;
  const trade = showWrap ? undefined : v2Trade;

  const parsedAmounts = showWrap
    ? {
        [Field.INPUT]: parsedAmount,
        [Field.OUTPUT]: parsedAmount,
      }
    : {
        [Field.INPUT]: independentField === Field.INPUT ? parsedAmount : trade?.inputAmount,
        [Field.OUTPUT]: independentField === Field.OUTPUT ? parsedAmount : trade?.outputAmount,
      };

  const { onSwitchTokens, onCurrencySelection, onUserInput, onChangeRecipient } = useSwapActionHandlers();
  const isValid = !swapInputError;
  const dependentField: Field = independentField === Field.INPUT ? Field.OUTPUT : Field.INPUT;

  const handleTypeInput = useCallback(
    (value: string) => {
      onUserInput(Field.INPUT, value);
    },
    [onUserInput]
  );
  const handleTypeOutput = useCallback(
    (value: string) => {
      onUserInput(Field.OUTPUT, value);
    },
    [onUserInput]
  );

  // modal and loading
  const [{ showConfirm, tradeToConfirm, swapErrorMessage, attemptingTxn, txHash }, setSwapState] = useState<{
    showConfirm: boolean;
    tradeToConfirm: Trade | undefined;
    attemptingTxn: boolean;
    swapErrorMessage: string | undefined;
    txHash: string | undefined;
  }>({
    showConfirm: false,
    tradeToConfirm: undefined,
    attemptingTxn: false,
    swapErrorMessage: undefined,
    txHash: undefined,
  });

  const formattedAmounts = {
    [independentField]: typedValue,
    [dependentField]: showWrap
      ? parsedAmounts[independentField]?.toExact() ?? ''
      : parsedAmounts[dependentField]?.toSignificant(6) ?? '',
  };

  const route = trade?.route;
  const userHasSpecifiedInputOutput = Boolean(
    currencies[Field.INPUT] && currencies[Field.OUTPUT] && parsedAmounts[independentField]?.greaterThan(JSBI.BigInt(0))
  );
  const noRoute = !route;

  // check whether the user has approved the router on the input token
  const [approval, approveCallback] = useApproveCallbackFromTrade(trade, allowedSlippage);

  // check if user has gone through approval process, used to show two step buttons, reset on token change
  const [approvalSubmitted, setApprovalSubmitted] = useState<boolean>(false);

  // mark when a user has submitted an approval, reset onTokenSelection for input field
  useEffect(() => {
    if (approval === ApprovalState.PENDING) {
      setApprovalSubmitted(true);
    }
  }, [approval, approvalSubmitted]);

  const maxAmountInput: CurrencyAmount | undefined = maxAmountSpend(currencyBalances[Field.INPUT]);
  const atMaxAmountInput = Boolean(maxAmountInput && parsedAmounts[Field.INPUT]?.equalTo(maxAmountInput));

  // the callback to execute the swap
  const { callback: swapCallback, error: swapCallbackError } = useSwapCallback(trade, allowedSlippage, recipient);

  const { priceImpactWithoutFee } = computeTradePriceBreakdown(trade);

  const [singleHopOnly] = useUserSingleHopOnly();

  const handleSwap = useCallback(() => {
    if (priceImpactWithoutFee && !confirmPriceImpactWithoutFee(priceImpactWithoutFee)) {
      return;
    }
    if (!swapCallback) {
      return;
    }
    setSwapState({ attemptingTxn: true, tradeToConfirm, showConfirm, swapErrorMessage: undefined, txHash: undefined });
    swapCallback()
      .then((hash) => {
        setSwapState({ attemptingTxn: false, tradeToConfirm, showConfirm, swapErrorMessage: undefined, txHash: hash });
      })
      .catch((error) => {
        setSwapState({
          attemptingTxn: false,
          tradeToConfirm,
          showConfirm,
          swapErrorMessage: error.message,
          txHash: undefined,
        });
      });
  }, [priceImpactWithoutFee, swapCallback, tradeToConfirm, showConfirm]);

  // errors
  const [showInverted, setShowInverted] = useState<boolean>(false);

  // warnings on slippage
  const priceImpactSeverity = warningSeverity(priceImpactWithoutFee);

  // show approve flow when: no error on inputs, not approved or pending, or approved in current session
  // never show if price impact is above threshold in non expert mode
  const showApproveFlow =
    !swapInputError &&
    (approval === ApprovalState.NOT_APPROVED ||
      approval === ApprovalState.PENDING ||
      (approvalSubmitted && approval === ApprovalState.APPROVED)) &&
    !(priceImpactSeverity > 3 && !isExpertMode);

  const handleConfirmDismiss = useCallback(() => {
    setSwapState({ showConfirm: false, tradeToConfirm, attemptingTxn, swapErrorMessage, txHash });
    // if there was a tx hash, we want to clear the input
    if (txHash) {
      onUserInput(Field.INPUT, '');
    }
  }, [attemptingTxn, onUserInput, swapErrorMessage, tradeToConfirm, txHash]);

  const handleAcceptChanges = useCallback(() => {
    setSwapState({ tradeToConfirm: trade, swapErrorMessage, txHash, attemptingTxn, showConfirm });
  }, [attemptingTxn, showConfirm, swapErrorMessage, trade, txHash]);

  const handleInputSelect = useCallback(
    (inputCurrency) => {
      setApprovalSubmitted(false); // reset 2 step UI for approvals
      onCurrencySelection(Field.INPUT, inputCurrency);
    },
    [onCurrencySelection]
  );

  const handleMaxInput = useCallback(() => {
    onUserInput(Field.INPUT, Number(balance));
  }, [Number(balance), onUserInput]);

  const handleOutputSelect = useCallback(
    (outputCurrency) => onCurrencySelection(Field.OUTPUT, outputCurrency),
    [onCurrencySelection]
  );

  const handleApprove = async () => {
    if (!library || !account) return;
    const tokenContract = new Contract(TOKEN_ADDRESS, ERC20_ABI, library.getSigner(account));
    try {
      // Convert the amount to wei format
      const amountInWei = parseUnits(formattedAmounts[Field.INPUT], 6); // adjust 18 if your token has a different number of decimals
      const tx = await tokenContract.approve(SPENDER_ADDRESS, amountInWei);
      console.log('Approval transaction:', tx);
      await tx.wait(); // waits for the transaction to be mined
      console.log('Transaction has been mined!');
    } catch (err) {
      console.error('Approval error:', err);
    }
  };

  async function handleBridge() {
    const contract = new Contract(CONTRACT_ADDRESS, TRANSFER_ABI, library!.getSigner());
    const formattedAmount = parseUnits(formattedAmounts[Field.INPUT], 6);
    console.log('Formatted amount:', formattedAmount);
    if (account) {
      try {
        const tx = await contract.transfer(account, formattedAmount, account, true); // Assuming express mode is true
        const receipt = await tx.wait();
        console.log('Transfer transaction receipt:', receipt);
      } catch (error) {
        console.error('Error during transfer:', error);
      }
    }
  }

  useEffect(() => {
    // Check if the user is on the /gud page
    if (location.pathname === '/gud') {
      // If they are not on POLYGON or MUMBAI
      if (chainId !== ChainId.MUMBAI) {
        // Inform the user to switch networks
        alert('Please switch to Mumbai network to access this page.');

        // Optional: If you have permissions, you can programmatically switch the network for the user
        if (library && library.provider.request) {
          library.provider
            .request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: `0x${ChainId.MUMBAI.toString(16)}` }], // This switches to Polygon, but you can set up logic for Mumbai as well
            })
            .catch((switchError) => {
              if (switchError.code === 4902) {
                // add the network
                library.provider
                  .request({
                    method: 'wallet_addEthereumChain',
                    params: [
                      {
                        chainId: `0x${ChainId.MUMBAI.toString(16)}`,
                        chainName: 'Mumbai',
                        nativeCurrency: {
                          name: 'Matic',
                          symbol: 'MATIC',
                          decimals: 18,
                        },
                        rpcUrls: ['https://rpc-mumbai.maticvigil.com/'],
                        blockExplorerUrls: ['https://mumbai.polygonscan.com/'],
                      },
                    ],
                  })
                  .catch((addError) => {
                    console.error(addError);
                  });
              } else {
                console.error(switchError);
              }
            });
        }
      }
    }
  }, [location.pathname, chainId, library]);

  useEffect(() => {
    if (account && library) {
      const tokenContract = new Contract('0x607D772B71FF8480a6A0D9b148D951AEdc990769', ERC20_ABI, library);

      const fetchAllowance = async () => {
        try {
          const result = await tokenContract.allowance(account, '0x771a7B1148420590774c5692F34cce3dC22e84f5');
          setAllowance(result.toString());
        } catch (err) {
          console.error('Error fetching allowance:', err);
        }
      };

      fetchAllowance();
    }
  }, [account, library, formattedAmounts[Field.INPUT]]);

  return (
    <>
      <TokenWarningModal
        isOpen={importTokensNotInDefault.length > 0 && !dismissTokenWarning}
        tokens={importTokensNotInDefault}
        onConfirm={handleConfirmTokenWarning}
      />
      <SwapPoolTabs active={'gud'} />
      <AppBody>
        <GudHeader expressMode={expressMode} setExpressMode={setExpressMode} />
        <Wrapper id="gud-page">
          <ConfirmSwapModal
            isOpen={showConfirm}
            trade={trade}
            originalTrade={tradeToConfirm}
            onAcceptChanges={handleAcceptChanges}
            attemptingTxn={attemptingTxn}
            txHash={txHash}
            recipient={recipient}
            allowedSlippage={allowedSlippage}
            onConfirm={handleSwap}
            swapErrorMessage={swapErrorMessage}
            onDismiss={handleConfirmDismiss}
          />

          <AutoColumn gap={'md'}>
            <CurrencyInputPanelGud
              label={'Input value:'}
              value={formattedAmounts[Field.INPUT]}
              showMaxButton={!atMaxAmountInput}
              currency={currencies[Field.INPUT]}
              onUserInput={handleTypeInput}
              onMax={handleMaxInput}
              balance={balance}
              setBalance={setBalance}
              onCurrencySelect={handleInputSelect}
              otherCurrency={currencies[Field.OUTPUT]}
              id="swap-currency-input"
            />

            {recipient !== null && !showWrap ? (
              <>
                <AutoRow justify="space-between" style={{ padding: '0 1rem' }}>
                  <ArrowWrapper clickable={false}>
                    <ArrowDown size="16" color={theme.text2} />
                  </ArrowWrapper>
                  <LinkStyledButton id="remove-recipient-button" onClick={() => onChangeRecipient(null)}>
                    - Remove send
                  </LinkStyledButton>
                </AutoRow>
                <AddressInputPanel id="recipient" value={recipient} onChange={onChangeRecipient} />
              </>
            ) : null}

            {showWrap ? null : (
              <Card padding={showWrap ? '.25rem 1rem 0 1rem' : '0px'} borderRadius={'20px'}>
                <AutoColumn gap="8px" style={{ padding: '3px 4px' }}>
                  {Boolean(trade) && (
                    <RowBetween align="center">
                      <Text fontWeight={500} fontSize={14} color={theme.text2}>
                        Price
                      </Text>
                      <TradePrice
                        price={trade?.executionPrice}
                        showInverted={showInverted}
                        setShowInverted={setShowInverted}
                      />
                    </RowBetween>
                  )}
                  <RowBetween align="center">
                    <ClickableText fontWeight={500} fontSize={14} color={theme.text2}>
                      {/* onClick={toggleSettings}^ */}
                      Bridging Fee
                    </ClickableText>
                    <ClickableText fontWeight={500} fontSize={14} color={theme.text2}>
                      {/* onClick={toggleSettings}^ */}
                      {allowedSlippage / 100}%
                    </ClickableText>
                  </RowBetween>
                </AutoColumn>
              </Card>
            )}
          </AutoColumn>

          <BottomGrouping>
            {!account ? (
              <ButtonSlanted onClick={toggleWalletModal}>Connect Wallet</ButtonSlanted>
            ) : chainId !== ChainId.MUMBAI ? (
              <ButtonError>Please switch to the Mumbai network</ButtonError>
            ) : formattedAmounts[Field.INPUT] === '' ? (
              <ButtonError disabled>Please enter valid amount</ButtonError>
            ) : formattedAmounts[Field.INPUT] > allowance ? (
              <ButtonSlanted onClick={() => handleApprove()}>Approve</ButtonSlanted>
            ) : (
              <ButtonSlanted onClick={() => handleBridge()}>Bridge</ButtonSlanted>
            )}
            {showApproveFlow && (
              <Column style={{ marginTop: '1rem' }}>
                <ProgressSteps steps={[approval === ApprovalState.APPROVED]} />
              </Column>
            )}
            {isExpertMode && swapErrorMessage ? <SwapCallbackError error={swapErrorMessage} /> : null}
          </BottomGrouping>
        </Wrapper>

        {trade && <AdvancedSwapDetailsDropdown trade={trade} />}
      </AppBody>
    </>
  );
}