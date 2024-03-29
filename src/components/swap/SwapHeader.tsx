import React from 'react';
import styled from 'styled-components';
import Settings, { SettingsUSDC } from '../Settings';
import { RowBetween } from '../Row';
import { TYPE } from '../../theme';

const StyledSwapHeader = styled.div`
  padding: 12px 1rem 0px 1.5rem;
  margin-bottom: 0.4rem;
  width: 100%;
  color: ${({ theme }) => theme.text2};
`;

export default function SwapHeader() {
  return (
    <StyledSwapHeader>
      <RowBetween>
        <TYPE.black fontWeight={500}>Swap</TYPE.black>
        <Settings />
      </RowBetween>
    </StyledSwapHeader>
  );
}

/* eslint-disable react/prop-types */
export function USDCHeader({ expressMode, setExpressMode }) {
  return (
    <StyledSwapHeader>
      <RowBetween>
        <TYPE.black fontWeight={500}>USDC Bridge</TYPE.black>
        <SettingsUSDC expressMode={expressMode} setExpressMode={setExpressMode} />
      </RowBetween>
    </StyledSwapHeader>
  );
}
