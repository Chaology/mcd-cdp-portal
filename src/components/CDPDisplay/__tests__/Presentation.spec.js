import React, { Fragment } from 'react';
import * as navi from 'react-navi';
import Presentation from '../Presentation';
import { cleanup, fireEvent, waitForElement } from '@testing-library/react';
import {
  renderWithMaker,
  renderWithStore
} from '../../../../test/helpers/render';
import { createCurrency } from '@makerdao/currency';
import BigNumber from 'bignumber.js';
import styled from 'styled-components';

jest.mock('mixpanel-browser', () => ({
  init: jest.fn(),
  track: jest.fn()
}));

jest.mock('react-navi');
navi.useCurrentRoute.mockReturnValue({
  url: { search: '?network=testnet', pathname: '/test' }
});
navi.Link = styled.a``;

const LOL = createCurrency('LOL');

afterEach(cleanup);

const cdp = {
  id: 1,
  ilk: 'LOL-A',
  ink: '10',
  art: '80',
  rate: '1.5',
  liquidationRatio: 150,
  price: LOL(200),
  currency: {
    symbol: 'LOL'
  }
};

const account = {
  cdps: [{ id: 1 }]
};

test('basic rendering', () => {
  const showSidebar = jest.fn(() => {});
  const { getByText } = renderWithStore(
    <Presentation cdp={cdp} account={account} showSidebar={showSidebar} />
  );
  getByText('9.10 LOL');
  getByText('1820.00 USD');
  getByText('120.00 DAI');
  getByText('1213.33 DAI');

  fireEvent.click(getByText('Deposit'));
  expect(showSidebar).toBeCalledWith({ type: 'deposit', props: { cdpId: 1 } });
});

test('render liquidation price correctly when no debt', () => {
  const showSidebar = jest.fn(() => {});
  const newCdp = { ...cdp, price: LOL(0), art: '0', ink: '0' };
  const { getByText } = renderWithStore(
    <Presentation cdp={newCdp} account={account} showSidebar={showSidebar} />
  );
  getByText('N/A');
  getByText('0.0000 USD');
});

test('reclaim banner rounds correctly when value is > 1', async () => {
  const showSidebar = jest.fn(() => {});
  const newCdp = {
    ...cdp,
    gem: 'LOL',
    unlockedCollateral: new BigNumber('213.1234567890123456')
  };
  const { findByText } = renderWithStore(
    <Presentation cdp={newCdp} account={account} showSidebar={showSidebar} />
  );
  // two decimal places for values > 1
  await findByText(/213.12 LOL/);
});

test('reclaim banner rounds correctly when number is < 1', async () => {
  const showSidebar = jest.fn(() => {});
  const newCdp = {
    ...cdp,
    gem: 'LOL',
    unlockedCollateral: new BigNumber('0.1234567890123456')
  };
  const { findByText } = renderWithStore(
    <Presentation cdp={newCdp} account={account} showSidebar={showSidebar} />
  );
  // four decimal places for values < 1
  await findByText(/0.1235 LOL/);
});

describe('on mobile', () => {
  let getComputedStyleOrig;

  beforeAll(() => {
    Object.defineProperty(window.document.documentElement, 'clientWidth', {
      value: 320
    });
    getComputedStyleOrig = window.getComputedStyle;
    window.getComputedStyle = () => ({ fontSize: '16px' });
  });

  afterAll(() => {
    Object.defineProperty(window.document.documentElement, 'clientWidth', {
      value: 0
    });
    window.getComputedStyle = getComputedStyleOrig;
  });

  test('render an action full-screen', async () => {
    const showSidebar = jest.fn();
    const {
      findByText,
      getByText,
      getAllByText,
      getByTestId
    } = renderWithMaker(
      <Fragment>
        <Presentation cdp={cdp} account={account} showSidebar={showSidebar} />
        <div id="portal1" />
      </Fragment>,
      state => {
        const newState = {
          ...state,
          cdps: {
            '1': {
              ilk: 'ETH-A',
              ink: '2',
              art: '5',
              currency: {
                symbol: 'ETH'
              }
            }
          }
        };
        newState.feeds.find(i => i.key === 'ETH-A').rate = '1.5';
        return newState;
      }
    );
    await waitForElement(() => getAllByText('Outstanding Dai debt'));
    fireEvent.click(getByText('Deposit'));
    await findByText(/would you like to deposit/);
    expect(showSidebar).not.toBeCalled();
    getByText('New liquidation price');
    const input = getByTestId(
      (content, element) =>
        content === 'deposit-input' && element.tagName.toLowerCase() === 'input'
    );
    fireEvent.change(input, { target: { value: '10000' } });
    getByText(/Insufficient/);
  });
});
