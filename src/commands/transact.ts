import TelegramBot from 'node-telegram-bot-api';
import { CommandDependencies } from '../types';
import { ERROR_MESSAGES, INFO_MESSAGES, SUCCESS_MESSAGES, RESPONSE_TIMEOUT } from '../constants';

export async function handleTransact(
  msg: TelegramBot.Message,
  { bot, privy, sessions }: CommandDependencies
): Promise<void> {
  try {
    // Validate inputs
    if (!msg.from) {
      console.error('[/transact] Missing msg.from');
      return;
    }
    if (!msg.chat || !msg.chat.id) {
      console.error('[/transact] Missing chat ID');
      return;
    }

    const userId = msg.from.id;
    const chatId = msg.chat.id;
    console.log(`[/transact] User ${userId} initiating transaction`);

    // Check session
    const session = sessions.get(userId);
    if (!session) {
      console.log(`[/transact] No session found for user ${userId}`);
      await bot.sendMessage(chatId, ERROR_MESSAGES.NO_SESSION);
      return;
    }

    // Prompt confirmation with timeout
    await bot.sendMessage(
      chatId,
      "🔔 Transaction Request\n\nApprove sample Uniswap V4 swap on Ethereum?\n\n✅ Reply YES to approve\n❌ Reply NO to cancel\n\n⏱️ You have 60 seconds to respond."
    );

    let responseReceived = false;
    const timeoutId = setTimeout(async () => {
      if (!responseReceived) {
        console.log(`[/transact] User ${userId} response timeout`);
        try {
          await bot.sendMessage(chatId, INFO_MESSAGES.TRANSACTION_TIMEOUT);
        } catch (error) {
          console.error('[/transact] Failed to send timeout message:', error);
        }
      }
    }, RESPONSE_TIMEOUT);

    bot.once('message', async (confirmMsg) => {
      try {
        responseReceived = true;
        clearTimeout(timeoutId);

        // Validate confirmation message
        if (!confirmMsg || !confirmMsg.from || confirmMsg.from.id !== userId) {
          console.log('[/transact] Invalid confirmation message');
          return;
        }

        if (!confirmMsg.text) {
          await bot.sendMessage(chatId, "❌ Please reply with text: YES or NO.");
          return;
        }

        const response = confirmMsg.text.toLowerCase().trim();
        console.log(`[/transact] User ${userId} responded: ${response}`);

        if (response === 'yes') {
          try {
            const txParams = {
              to: '0x...', // recipient address
              value: '0', // amount in wei
              data: '0x' // transaction data
            };

            console.log(`[/transact] Sending transaction for user ${userId}, wallet ${session.walletId}`);
            const txResponse = await privy.wallets().ethereum().sendTransaction(session.walletId, {
              caip2: 'eip155:1', // Ethereum mainnet (use testnet for testing)
              params: { transaction: txParams }
            });

            console.log(`[/transact] Transaction successful: ${txResponse.hash}`);
            await bot.sendMessage(chatId, SUCCESS_MESSAGES.TRANSACTION_SENT(txResponse.hash));
          } catch (error) {
            console.error('[/transact] Transaction failed:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            await bot.sendMessage(chatId, `${ERROR_MESSAGES.TRANSACTION_FAILED}\n\nError: ${errorMessage}`);
          }
        } else if (response === 'no') {
          console.log(`[/transact] User ${userId} canceled transaction`);
          await bot.sendMessage(chatId, INFO_MESSAGES.TRANSACTION_CANCELED);
        } else {
          await bot.sendMessage(chatId, INFO_MESSAGES.INVALID_RESPONSE);
        }
      } catch (error) {
        console.error('[/transact] Error handling confirmation:', error);
        try {
          await bot.sendMessage(chatId, "❌ An error occurred. Please try again with /transact.");
        } catch (sendError) {
          console.error('[/transact] Failed to send error message:', sendError);
        }
      }
    });
  } catch (error) {
    console.error('[/transact] Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    try {
      if (msg.chat && msg.chat.id) {
        await bot.sendMessage(msg.chat.id, `${ERROR_MESSAGES.GENERIC_ERROR}\n\nError: ${errorMessage}`);
      }
    } catch (sendError) {
      console.error('[/transact] Failed to send error message:', sendError);
    }
  }
}
