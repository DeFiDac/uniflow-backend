/**
 * WalletService Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WalletService } from '../../../src/core/WalletService';
import { ErrorCodes } from '../../../src/core/types';
import { APIError } from '@privy-io/node';

// Mock Privy client
const createMockPrivyClient = () => {
  const mockGetByTelegramUserID = vi.fn();
  const mockCreateUser = vi.fn();
  const mockCreateWallet = vi.fn();
  const mockSendTransaction = vi.fn();

  return {
    users: vi.fn(() => ({
      getByTelegramUserID: mockGetByTelegramUserID,
      create: mockCreateUser,
    })),
    wallets: vi.fn(() => ({
      create: mockCreateWallet,
      ethereum: vi.fn(() => ({
        sendTransaction: mockSendTransaction,
      })),
    })),
    _mocks: {
      getByTelegramUserID: mockGetByTelegramUserID,
      createUser: mockCreateUser,
      createWallet: mockCreateWallet,
      sendTransaction: mockSendTransaction,
    },
  };
};

describe('WalletService', () => {
  let walletService: WalletService;
  let mockPrivy: ReturnType<typeof createMockPrivyClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrivy = createMockPrivyClient();
    walletService = new WalletService(mockPrivy as any);

    // Set required env var
    process.env.PRIVY_SIGNER_ID = 'test-signer-id';
  });

  describe('connect', () => {
    it('should create new user and wallet for new user', async () => {
      // User doesn't exist - create proper APIError
      const apiError = Object.create(APIError.prototype);
      Object.assign(apiError, { status: 404, message: 'Not found' });
      mockPrivy._mocks.getByTelegramUserID.mockRejectedValue(apiError);

      // Create user returns new user
      mockPrivy._mocks.createUser.mockResolvedValue({
        id: 'privy-user-123',
        linked_accounts: [],
      });

      // Create wallet returns new wallet
      mockPrivy._mocks.createWallet.mockResolvedValue({
        id: 'wallet-abc123',
      });

      const result = await walletService.connect('telegram_123');

      expect(result.success).toBe(true);
      expect(result.walletId).toBe('wallet-abc123');
      expect(result.privyUserId).toBe('privy-user-123');
      expect(result.isNewUser).toBe(true);
    });

    it('should use existing wallet for returning user', async () => {
      // User exists with wallet
      mockPrivy._mocks.getByTelegramUserID.mockResolvedValue({
        id: 'privy-user-123',
        linked_accounts: [
          {
            type: 'wallet',
            wallet_client: 'privy',
            id: 'existing-wallet-id',
          },
        ],
      });

      const result = await walletService.connect('telegram_123');

      expect(result.success).toBe(true);
      expect(result.walletId).toBe('existing-wallet-id');
      expect(result.isNewUser).toBe(false);
      expect(mockPrivy._mocks.createWallet).not.toHaveBeenCalled();
    });
  });

  describe('transact', () => {
    it('should return SESSION_NOT_FOUND for disconnected user', async () => {
      const result = await walletService.transact('unknown-user', {
        to: '0x123',
        value: '0',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(ErrorCodes.SESSION_NOT_FOUND);
    });

    it('should send transaction for connected user', async () => {
      // First connect the user
      mockPrivy._mocks.getByTelegramUserID.mockResolvedValue({
        id: 'privy-user-123',
        linked_accounts: [
          {
            type: 'wallet',
            wallet_client: 'privy',
            id: 'wallet-abc123',
          },
        ],
      });
      await walletService.connect('telegram_123');

      // Mock transaction response
      mockPrivy._mocks.sendTransaction.mockResolvedValue({
        hash: '0xtxhash123',
      });

      const result = await walletService.transact('telegram_123', {
        to: '0xrecipient',
        value: '1000000000000000000',
      });

      expect(result.success).toBe(true);
      expect(result.hash).toBe('0xtxhash123');
    });
  });

  describe('disconnect', () => {
    it('should return true when session exists', async () => {
      // Connect first
      mockPrivy._mocks.getByTelegramUserID.mockResolvedValue({
        id: 'privy-user-123',
        linked_accounts: [
          {
            type: 'wallet',
            wallet_client: 'privy',
            id: 'wallet-abc123',
          },
        ],
      });
      await walletService.connect('telegram_123');

      const result = walletService.disconnect('telegram_123');
      expect(result).toBe(true);
    });

    it('should return false when no session exists', () => {
      const result = walletService.disconnect('unknown-user');
      expect(result).toBe(false);
    });
  });

  describe('getSession', () => {
    it('should return session data for connected user', async () => {
      mockPrivy._mocks.getByTelegramUserID.mockResolvedValue({
        id: 'privy-user-123',
        linked_accounts: [
          {
            type: 'wallet',
            wallet_client: 'privy',
            id: 'wallet-abc123',
          },
        ],
      });
      await walletService.connect('telegram_123');

      const session = walletService.getSession('telegram_123');
      expect(session).toBeDefined();
      expect(session?.walletId).toBe('wallet-abc123');
    });

    it('should return undefined for unknown user', () => {
      const session = walletService.getSession('unknown-user');
      expect(session).toBeUndefined();
    });
  });
});
