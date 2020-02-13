import { fromWei } from 'utils/units';

// export function accountBalanceForToken(addresses, tokenSymbol, accountAddress) {
//   return [
//     {
//       target: tokenSymbol === 'ETH' ? null : addresses[tokenSymbol],
//       call: [
//         tokenSymbol === 'ETH'
//           ? 'getEthBalance(address)(uint256)'
//           : 'balanceOf(address)(uint256)',
//         accountAddress
//       ],
//       returns: [
//         [`accounts.${accountAddress}.balances.${tokenSymbol}`, fromWei]
//       ],
//       meta: { accountBalanceForToken: true }
//     }
//   ];
// }

export function accountProxyAllowanceForToken(
  addresses,
  tokenSymbol,
  accountAddress,
  proxyAddress
) {
  return [
    {
      target: addresses[tokenSymbol],
      call: [
        'allowance(address,address)(uint256)',
        accountAddress,
        proxyAddress
      ],
      returns: [
        [
          `accounts.${accountAddress}.allowances.${tokenSymbol}`,
          // Unlimited allowance may be a tiny bit less than MAX_UINT_BN,
          // calling .toNumber() gives us a reasonably large number to compare.
          allowance => fromWei(allowance).toNumber()
        ]
      ],
      meta: { accountProxyAllowanceForToken: true }
    }
  ];
}

// export function accountSavings(addresses, accountAddress, proxyAddress) {
//   return [
//     {
//       target: addresses.MCD_POT,
//       call: ['pie(address)(uint256)', proxyAddress],
//       returns: [[`accounts.${accountAddress}.savings`, fromWei]],
//       meta: { accountSavings: true }
//     }
//   ];
// }
