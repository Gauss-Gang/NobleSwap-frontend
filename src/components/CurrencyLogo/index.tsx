import { Currency, ETHER, Token } from '@uniswap/sdk';
import React, { useMemo } from 'react';
import styled from 'styled-components';

import GangLogo from '../../assets/images/gang-logo.png';
import UsdcLogo from '../../assets/images/usdc.png';
import useHttpLocations from '../../hooks/useHttpLocations';
import { WrappedTokenInfo } from '../../state/lists/hooks';
import Logo from '../Logo';

const getTokenLogoURL = (address: string) =>
  `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${address}/logo.png`;

const StyledGangLogo = styled.img<{ size: string }>`
  width: ${({ size }) => size};
  height: ${({ size }) => size};
  box-shadow: 0px 6px 10px rgba(0, 0, 0, 0.075);
  border-radius: 24px;
`;

const StyledUsdcLogo = styled.img<{ size: string }>`
  width: ${({ size }) => size};
  height: ${({ size }) => size};
  box-shadow: 0px 6px 10px rgba(0, 0, 0, 0.075);
  border-radius: 24px;
`;

const StyledLogo = styled(Logo)<{ size: string }>`
  width: ${({ size }) => size};
  height: ${({ size }) => size};
  border-radius: ${({ size }) => size};
  box-shadow: 0px 6px 10px rgba(0, 0, 0, 0.075);
  background-color: ${({ theme }) => theme.white};
`;

export default function CurrencyLogo({
  currency,
  size = '24px',
  style,
}: {
  currency?: Currency;
  size?: string;
  style?: React.CSSProperties;
}) {
  const uriLocations = useHttpLocations(currency instanceof WrappedTokenInfo ? currency.logoURI : undefined);

  const srcs: string[] = useMemo(() => {
    if (currency === ETHER) return [];

    if (currency instanceof Token) {
      if (currency instanceof WrappedTokenInfo) {
        return [...uriLocations, getTokenLogoURL(currency.address)];
      }

      return [getTokenLogoURL(currency.address)];
    }
    return [];
  }, [currency, uriLocations]);

  if (currency === ETHER) {
    return <StyledGangLogo src={GangLogo} size={size} style={style} />;
  }

  return <StyledLogo size={size} srcs={srcs} alt={`${currency?.symbol ?? 'token'} logo`} style={style} />;
}

export function CurrencyLogoUSDC({
  currency,
  size = '24px',
  style,
}: {
  currency?: Currency;
  size?: string;
  style?: React.CSSProperties;
}) {
  const uriLocations = useHttpLocations(currency instanceof WrappedTokenInfo ? currency.logoURI : undefined);

  const srcs: string[] = useMemo(() => {
    if (currency instanceof Token) {
      getTokenLogoURL('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
      if (currency instanceof WrappedTokenInfo) {
        return [...uriLocations, getTokenLogoURL('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')];
      }

      return [getTokenLogoURL('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')];
    }
    return [];
  }, [currency, uriLocations]);

  if (currency === ETHER) {
    return <StyledUsdcLogo src={UsdcLogo} size={size} style={style} />;
  }

  return <StyledLogo size={size} srcs={srcs} alt={`${currency?.symbol ?? 'token'} logo`} style={style} />;
}
