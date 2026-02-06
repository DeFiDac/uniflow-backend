/**
 * PriceService - CoinMarketCap integration for token price fetching
 */

import axios from 'axios';
import { PriceData } from './types';

export class PriceService {
	private apiKey: string;
	private priceCache: Map<string, PriceData>;
	private readonly CACHE_TTL_MS = 60000; // 1 minute
	private readonly CMC_API_BASE = 'https://pro-api.coinmarketcap.com';

	constructor(apiKey?: string) {
		this.apiKey = apiKey || process.env.COINMARKETCAP_API_KEY || '';
		this.priceCache = new Map();

		if (!this.apiKey) {
			console.warn(
				'⚠️  [PriceService] No CoinMarketCap API key provided - prices will not be available'
			);
		}
	}

	/**
	 * Fetch USD prices for multiple token addresses
	 * Returns Map<address, priceUsd>
	 */
	async getTokenPrices(
		addresses: string[],
		chainId: number
	): Promise<Map<string, number>> {
		const result = new Map<string, number>();

		if (!this.apiKey) {
			console.warn(
				'[PriceService] No API key - returning zero prices for all tokens'
			);
			addresses.forEach((addr) => result.set(addr.toLowerCase(), 0));
			return result;
		}

		// Normalize addresses to lowercase
		const normalizedAddresses = addresses.map((addr) => addr.toLowerCase());

		// Check cache first
		const uncachedAddresses: string[] = [];
		for (const address of normalizedAddresses) {
			const cached = this.getCachedPrice(address);
			if (cached) {
				result.set(address, cached.priceUsd);
			} else {
				uncachedAddresses.push(address);
			}
		}

		if (uncachedAddresses.length === 0) {
			console.log(
				`[PriceService] All ${addresses.length} prices served from cache`
			);
			return result;
		}

		// Fetch uncached prices from CoinMarketCap
		console.log(
			`[PriceService] Fetching ${uncachedAddresses.length} prices from CoinMarketCap (chainId: ${chainId})`
		);

		try {
			const platformMap: Record<number, string> = {
				1: 'ethereum',
				56: 'binance-smart-chain',
				8453: 'base',
				42161: 'arbitrum-one',
				1301: 'ethereum', // Unichain - fallback to ethereum
			};

			const platform = platformMap[chainId] || 'ethereum';
			const addressParam = uncachedAddresses.join(',');

			const response = await axios.get(
				`${this.CMC_API_BASE}/v2/cryptocurrency/quotes/latest`,
				{
					params: {
						address: addressParam,
						convert: 'USD',
						aux: 'platform',
					},
					headers: {
						'X-CMC_PRO_API_KEY': this.apiKey,
					},
					timeout: 10000, // 10 second timeout
				}
			);

			// Parse response and update cache
			if (response.data && response.data.data) {
				const data = response.data.data;

				for (const address of uncachedAddresses) {
					// CMC returns data keyed by address
					const tokenData = data[address];

					if (tokenData && tokenData.quote && tokenData.quote.USD) {
						const priceUsd = tokenData.quote.USD.price;
						const symbol = tokenData.symbol || 'UNKNOWN';

						// Update cache
						this.priceCache.set(address, {
							address,
							symbol,
							priceUsd,
							timestamp: Date.now(),
						});

						// Add to result
						result.set(address, priceUsd);

						console.log(
							`[PriceService] Fetched ${symbol} (${address}): $${priceUsd.toFixed(2)}`
						);
					} else {
						console.warn(
							`[PriceService] No price data for ${address} - setting to 0`
						);
						result.set(address, 0);
					}
				}
			}
		} catch (error) {
			console.error('[PriceService] Failed to fetch prices:', error);

			// On error, return 0 for uncached addresses
			uncachedAddresses.forEach((addr) => result.set(addr, 0));
		}

		return result;
	}

	/**
	 * Get cached price if still valid
	 */
	private getCachedPrice(address: string): PriceData | null {
		const cached = this.priceCache.get(address.toLowerCase());
		if (!cached || Date.now() - cached.timestamp > this.CACHE_TTL_MS) {
			return null;
		}
		return cached;
	}

	/**
	 * Clear all cached prices (useful for testing)
	 */
	clearCache(): void {
		this.priceCache.clear();
	}

	/**
	 * Get cache size (useful for monitoring)
	 */
	getCacheSize(): number {
		return this.priceCache.size;
	}
}
