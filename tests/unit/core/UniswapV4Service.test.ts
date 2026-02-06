/**
 * Unit tests for UniswapV4Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UniswapV4Service } from '../../../src/core/UniswapV4Service';
import { PriceService } from '../../../src/core/PriceService';
import { V4Position } from '../../../src/core/types';

// Mock factories (shared instances)
const createMockPriceService = () => {
	return {
		getTokenPrices: vi.fn().mockResolvedValue(
			new Map([
				['0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', 3000],
				['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 1],
			])
		),
		clearCache: vi.fn(),
		getCacheSize: vi.fn().mockReturnValue(0),
	};
};

// Mock position data factory
const createMockPosition = (tokenId: string, chainId: number): V4Position => ({
	tokenId,
	chainId,
	chainName: chainId === 1 ? 'Ethereum' : 'Base',
	poolAddress: '0x1234...5678/0xabcd...efgh',
	token0: {
		token: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
		symbol: 'WETH',
		amount: '1.5',
		decimals: 18,
		usdValue: 4500,
	},
	token1: {
		token: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
		symbol: 'USDC',
		amount: '4500.0',
		decimals: 6,
		usdValue: 4500,
	},
	liquidity: '1000000',
	tickLower: -887220,
	tickUpper: 887220,
	feesUsd: 90,
	totalValueUsd: 9000,
});

describe('UniswapV4Service', () => {
	let service: UniswapV4Service;
	let mockPriceService: ReturnType<typeof createMockPriceService>;
	let getPositionsForChainSpy: any;

	beforeEach(() => {
		vi.clearAllMocks();
		mockPriceService = createMockPriceService();
		service = new UniswapV4Service(mockPriceService as unknown as PriceService);

		// Mock the private getPositionsForChain method to avoid real network calls
		getPositionsForChainSpy = vi
			.spyOn(service as any, 'getPositionsForChain')
			.mockImplementation(
				async (walletAddress: string, chainId: number): Promise<V4Position[]> => {
					// Return empty array for most cases (deterministic)
					// Can be overridden in specific tests
					return [];
				}
			);
	});

	afterEach(() => {
		// Restore the spy to avoid affecting other tests
		if (getPositionsForChainSpy) {
			getPositionsForChainSpy.mockRestore();
		}
	});

	describe('constructor', () => {
		it('should initialize with provided PriceService', () => {
			expect(service).toBeDefined();
		});

		it('should initialize with default PriceService if not provided', () => {
			const serviceDefault = new UniswapV4Service();
			expect(serviceDefault).toBeDefined();
		});
	});

	describe('getPositions', () => {
		it('should return empty positions for wallet with no positions', async () => {
			// This will fail initially due to network calls, but tests the structure
			const result = await service.getPositions(
				'0x0000000000000000000000000000000000000000'
			);
			expect(result.success).toBe(true);
			expect(Array.isArray(result.positions)).toBe(true);
		});

		it('should accept chainId parameter', async () => {
			const result = await service.getPositions(
				'0x0000000000000000000000000000000000000000',
				1
			);
			expect(result.success).toBe(true);
		});

		it('should return result with correct structure', async () => {
			const result = await service.getPositions(
				'0x0000000000000000000000000000000000000000'
			);

			expect(result).toHaveProperty('success');
			expect(result).toHaveProperty('positions');
			expect(result).toHaveProperty('totalValueUsd');
			expect(result).toHaveProperty('totalFeesUsd');
		});

		it('should handle invalid chainId gracefully', async () => {
			// Mock getPositionsForChain to throw for invalid chainId
			getPositionsForChainSpy.mockRejectedValueOnce(
				new Error('Unsupported chainId: 99999')
			);

			const result = await service.getPositions(
				'0x0000000000000000000000000000000000000000',
				99999
			);

			// getPositions should still return success: true with chainErrors
			expect(result.success).toBe(true);
			expect(result.chainErrors).toBeDefined();
			expect(result.chainErrors).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						chainId: 99999,
						error: expect.any(String),
					}),
				])
			);
		});
	});

	describe('error handling', () => {
		it('should include chainErrors when chain queries fail', async () => {
			// Mock getPositionsForChain to throw an error for chain 1
			getPositionsForChainSpy.mockRejectedValueOnce(
				new Error('GraphQL query failed')
			);

			const result = await service.getPositions(
				'0x0000000000000000000000000000000000000000',
				1
			);

			// Should still return success: true with chainErrors
			expect(result.success).toBe(true);
			expect(result.chainErrors).toBeDefined();
			expect(Array.isArray(result.chainErrors)).toBe(true);
			expect(result.chainErrors?.length).toBeGreaterThan(0);
		});
	});
});
