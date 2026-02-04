export const mockPrivyUser = {
  id: 'privy_user_123',
  linked_accounts: [],
  created_at: Date.now(),
};

export const mockPrivyUserWithWallet = {
  id: 'privy_user_123',
  linked_accounts: [
    {
      type: 'wallet' as const,
      address: '0x1234567890abcdef',
    },
  ],
  created_at: Date.now(),
};

export const mockWallet = {
  id: 'wallet_456',
  address: '0x1234567890abcdef',
  chain_type: 'ethereum',
};

export const mockTransactionResponse = {
  hash: '0xabcdef1234567890',
  status: 'success',
};
