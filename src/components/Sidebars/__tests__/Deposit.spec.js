import React from 'react';
import { cleanup, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import { createCurrencyRatio } from '@makerdao/currency';
import {
  TestAccountProvider,
  takeSnapshot,
  restoreSnapshot
} from '@makerdao/test-helpers';
import { BAT, USD } from '@makerdao/dai-plugin-mcd';
import BigNumber from 'bignumber.js';

import Deposit from '../Deposit';
import { renderWithMaker as render } from '../../../../test/helpers/render';
import lang from '../../../languages';
import useMaker from '../../../hooks/useMaker';

let snapshotData;
let account;

const ILK = 'BAT-A';
const INITIAL_BAT = '300.123456789012345678';
const INITIAL_ART = '25';

const PAR = new BigNumber('1000000000000000000000000000');

const DEBT_CEILING = '1000';
const RATE = '1.000967514019988230';
const DUST = '20';
const PRICE = createCurrencyRatio(USD, BAT)('0.24');
const LIQUIDATION_RATIO = '200';

const BAT_ACCOUNT_BALANCE = '200.123451234512345123';

const originalConsoleError = console.error;
jest.mock('mixpanel-browser', () => ({
  init: jest.fn(),
  track: jest.fn()
}));

jest.mock('react-navi', () => ({
  useCurrentRoute: () => ({ url: { pathname: '/test' } })
}));

beforeAll(async () => {
  snapshotData = await takeSnapshot();
  console.error = jest.fn();
  TestAccountProvider.setIndex(345);
  account = TestAccountProvider.nextAccount();
});

afterAll(() => {
  console.error = originalConsoleError;
  restoreSnapshot(snapshotData);
});

afterEach(cleanup);

const setupMockState = state => {
  const newState = {
    ...state,
    cdps: {
      1: {
        ilk: ILK,
        ink: INITIAL_BAT,
        art: INITIAL_ART
      }
    },
    feeds: [
      {
        key: ILK,
        currency: BAT,
        dust: DUST,
        rate: RATE,
        feedValueUSD: PRICE,
        debtCeiling: DEBT_CEILING,
        liquidationRatio: LIQUIDATION_RATIO
      }
    ],
    system: {
      par: PAR
    },
    accounts: {
      [account.address]: {
        balances: {
          [BAT.symbol]: BAT_ACCOUNT_BALANCE
        },
        allowances: {
          [BAT.symbol]: 201
        }
      }
    }
  };
  return newState;
};

// so that dispatched actions don't affect the mocked state
const identityReducer = x => x;
const renderWithMockedStore = component =>
  render(component, setupMockState, identityReducer);

test('basic rendering', async () => {
  const { findByText, findAllByText } = renderWithMockedStore(
    <Deposit cdpId={1} />
  );

  await findByText(
    lang.formatString(lang.action_sidebar.deposit_title, BAT.symbol)
  );
  await findAllByText(/BAT\/USD/);
});

test('input validation', async () => {
  const { getByText, getByRole, findByText } = renderWithMockedStore(
    React.createElement(() => {
      const { maker } = useMaker();

      React.useEffect(() => {
        const accountService = maker.service('accounts');
        accountService
          .addAccount('noproxy', {
            type: 'privateKey',
            key: account.key
          })
          .then(() => accountService.useAccount('noproxy'));
      }, []);

      return <Deposit cdpId={1} />;
    })
  );

  await findByText(`${BAT_ACCOUNT_BALANCE} BAT`);

  const input = getByRole('textbox');

  // can't deposit more BAT than there is in the connected wallet
  fireEvent.change(input, { target: { value: '201' } });
  const balanceTooLowEl = getByText(
    lang.formatString(lang.action_sidebar.insufficient_balance, BAT.symbol)
  );
  // the message goes away when the input is corrected
  fireEvent.change(input, { target: { value: '200' } });
  expect(balanceTooLowEl).not.toBeInTheDocument();
});

test('verify info container values', async () => {
  const { getByText, findByText, getByRole } = renderWithMockedStore(
    React.createElement(() => {
      const { maker } = useMaker();

      React.useEffect(() => {
        const accountService = maker.service('accounts');
        accountService
          .addAccount('noproxy', {
            type: 'privateKey',
            key: account.key
          })
          .then(() => accountService.useAccount('noproxy'));
      }, []);

      return <Deposit cdpId={1} />;
    })
  );

  // BAT account balance
  await findByText(`${BAT_ACCOUNT_BALANCE} BAT`);
  // BAT/USD price
  await findByText(PRICE.toNumber().toString(), { exact: false });
  // initial liquidation price
  await findByText(/0.17 BAT\/USD/);
  // initial collat ratio
  await findByText(/287.89%/);

  const input = getByRole('textbox');
  fireEvent.change(input, { target: { value: BAT_ACCOUNT_BALANCE } });

  // new liquidation price
  getByText(/0.1 BAT\/USD/);
  // new simulated collat ratio
  getByText(/479.85%/);
  // BAT available remains the same
  getByText(`${BAT_ACCOUNT_BALANCE} BAT`);
  // BAT/USD price remains the same
  await findByText(PRICE.toNumber().toString(), { exact: false });
});

test('calls the lock function as expected', async () => {
  let maker;
  const { getByText, findByText, getByRole } = renderWithMockedStore(
    React.createElement(() => {
      maker = useMaker().maker;
      React.useEffect(() => {
        const accountService = maker.service('accounts');
        accountService
          .addAccount('noproxy', {
            type: 'privateKey',
            key: account.key
          })
          .then(() => accountService.useAccount('noproxy'));
        maker.service('proxy').getProxyAddress = () =>
          '0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E';
      }, []);

      return <Deposit cdpId={1} reset={() => {}} />;
    })
  );

  await findByText(`${BAT_ACCOUNT_BALANCE} BAT`);

  const input = getByRole('textbox');
  fireEvent.change(input, { target: { value: BAT_ACCOUNT_BALANCE } });

  const depositButton = getByText(lang.actions.deposit);
  const mockLock = jest.fn();
  maker.service('mcd:cdpManager').lock = mockLock;
  act(() => {
    fireEvent.click(depositButton);
  });

  expect(mockLock.mock.calls.length).toBe(1);
  // 1st arg should be the cdp id
  expect(mockLock.mock.calls[0][0]).toBe(1);
  // next, the ilk
  expect(mockLock.mock.calls[0][1]).toBe(ILK);
  // finally, the lock amount as a currency object
  expect(mockLock.mock.calls[0][2]).toMatchObject(BAT(BAT_ACCOUNT_BALANCE));
});
