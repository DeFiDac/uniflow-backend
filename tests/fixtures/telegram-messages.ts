import TelegramBot from 'node-telegram-bot-api';

export const createMockMessage = (overrides?: Partial<TelegramBot.Message>): TelegramBot.Message =>
	({
		message_id: 1,
		date: Date.now(),
		chat: {
			id: 123456,
			type: 'private',
		},
		from: {
			id: 789,
			is_bot: false,
			first_name: 'Test',
		},
		...overrides,
	}) as TelegramBot.Message;

export const mockMessageWithUser = (userId: number): TelegramBot.Message =>
	createMockMessage({
		from: {
			id: userId,
			is_bot: false,
			first_name: 'Test User',
		},
	});

export const mockMessageWithoutFrom = (): TelegramBot.Message =>
	createMockMessage({ from: undefined });

export const mockMessageWithoutChat = (): TelegramBot.Message =>
	createMockMessage({ chat: undefined } as any);
