/**
 * Unit tests for PriceService
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PriceService } from '../../../src/core/PriceService';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('PriceService', () => {
	let service: PriceService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new PriceService('test-api-key');
	});

	afterEach(() => {
		service.clearCache();
	});

	describe('constructor', () => {
		it('should initialize with provided API key', () => {
			const priceService = new PriceService('custom-key');
			expect(priceService).toBeDefined();
		});

		it('should warn when no API key provided', () => {
			// Stash and clear env var to ensure deterministic test
			const originalApiKey = process.env.COINMARKETCAP_API_KEY;
			delete process.env.COINMARKETCAP_API_KEY;

			try {
				const consoleSpy = vi
					.spyOn(console, 'warn')
					.mockImplementation(() => {});
				new PriceService();
				expect(consoleSpy).toHaveBeenCalledWith(
					expect.stringContaining('No CoinMarketCap API key')
				);
				consoleSpy.mockRestore();
			} finally {
				// Restore original env var
				if (originalApiKey !== undefined) {
					process.env.COINMARKETCAP_API_KEY = originalApiKey;
				}
			}
		});
	});

	describe('getTokenPrices', () => {
		it('should return zero prices when no API key', async () => {
			// Stash and clear env var to ensure deterministic test
			const originalApiKey = process.env.COINMARKETCAP_API_KEY;
			delete process.env.COINMARKETCAP_API_KEY;

			try {
				const serviceNoKey = new PriceService();
				const consoleSpy = vi
					.spyOn(console, 'warn')
					.mockImplementation(() => {});

				const prices = await serviceNoKey.getTokenPrices(
					['0xtoken1', '0xtoken2'],
					1
				);

				expect(prices.size).toBe(2);
				expect(prices.get('0xtoken1')).toBe(0);
				expect(prices.get('0xtoken2')).toBe(0);
				consoleSpy.mockRestore();
			} finally {
				// Restore original env var
				if (originalApiKey !== undefined) {
					process.env.COINMARKETCAP_API_KEY = originalApiKey;
				}
			}
		});

		it('should fetch prices from CoinMarketCap', async () => {
			const mockResponse = {
				data: {
					data: {
						'0xtoken1': {
							symbol: 'WETH',
							quote: { USD: { price: 3000 } },
						},
						'0xtoken2': {
							symbol: 'USDC',
							quote: { USD: { price: 1 } },
						},
					},
				},
			};

			mockedAxios.get.mockResolvedValueOnce(mockResponse);

			const prices = await service.getTokenPrices(
				['0xtoken1', '0xtoken2'],
				1
			);

			expect(prices.get('0xtoken1')).toBe(3000);
			expect(prices.get('0xtoken2')).toBe(1);
			expect(mockedAxios.get).toHaveBeenCalledWith(
				expect.stringContaining('coinmarketcap.com'),
				expect.objectContaining({
					headers: { 'X-CMC_PRO_API_KEY': 'test-api-key' },
				})
			);
		});

		it('should use cache for subsequent requests', async () => {
			const mockResponse = {
				data: {
					data: {
						'0xtoken1': {
							symbol: 'WETH',
							quote: { USD: { price: 3000 } },
						},
					},
				},
			};

			mockedAxios.get.mockResolvedValueOnce(mockResponse);

			// First call - should hit API
			await service.getTokenPrices(['0xtoken1'], 1);
			expect(mockedAxios.get).toHaveBeenCalledTimes(1);

			// Second call - should use cache
			const prices = await service.getTokenPrices(['0xtoken1'], 1);
			expect(mockedAxios.get).toHaveBeenCalledTimes(1); // Still 1
			expect(prices.get('0xtoken1')).toBe(3000);
		});

		it('should return 0 for tokens with missing price data', async () => {
			const mockResponse = {
				data: {
					data: {
						'0xtoken1': {
							symbol: 'WETH',
							quote: { USD: { price: 3000 } },
						},
						// 0xtoken2 missing
					},
				},
			};

			mockedAxios.get.mockResolvedValueOnce(mockResponse);
			const consoleSpy = vi
				.spyOn(console, 'warn')
				.mockImplementation(() => {});

			const prices = await service.getTokenPrices(
				['0xtoken1', '0xtoken2'],
				1
			);

			expect(prices.get('0xtoken1')).toBe(3000);
			expect(prices.get('0xtoken2')).toBe(0);
			consoleSpy.mockRestore();
		});

		it('should handle API errors gracefully', async () => {
			mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));
			const consoleSpy = vi
				.spyOn(console, 'error')
				.mockImplementation(() => {});

			const prices = await service.getTokenPrices(['0xtoken1'], 1);

			expect(prices.get('0xtoken1')).toBe(0);
			consoleSpy.mockRestore();
		});
	});

	describe('cache management', () => {
		it('should clear cache', () => {
			service.clearCache();
			expect(service.getCacheSize()).toBe(0);
		});

		it('should track cache size', async () => {
			const mockResponse = {
				data: {
					data: {
						'0xtoken1': {
							symbol: 'WETH',
							quote: { USD: { price: 3000 } },
						},
					},
				},
			};

			mockedAxios.get.mockResolvedValueOnce(mockResponse);
			await service.getTokenPrices(['0xtoken1'], 1);

			expect(service.getCacheSize()).toBe(1);
		});
	});
});
