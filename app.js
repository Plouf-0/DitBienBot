import 'dotenv/config';
import { Client, Events, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import {
  TARGET_EMOJI_ID,
  TARGET_EMOJI_KEY,
  getRankingByEmoji,
  getUserRank,
  incrementReactionCount,
  isTrackedEmojiKey,
  normalizeEmojiKey,
  resetRankingForEmoji,
} from './db.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED_REJECTION]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT_EXCEPTION]', error);
});

client.on(Events.Debug, (info) => {
  console.log('[DISCORD_DEBUG]', info);
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Bot ready: ${readyClient.user.tag}`);
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  if (!reaction.message.guildId) return;

  const emojiKey = normalizeEmojiKey(reaction.emoji);
  console.log('[REACTION_ADD] user=', user.id, 'emoji=', reaction.emoji?.name ?? reaction.emoji?.id, 'key=', emojiKey, 'tracked=', isTrackedEmojiKey(emojiKey));

  if (!emojiKey || !isTrackedEmojiKey(emojiKey)) return;

  incrementReactionCount({
    guildId: reaction.message.guildId,
    userId: user.id,
    emoji: emojiKey,
    delta: 1,
  });

  console.log('[REACTION_ADD_DB] saved for guild=', reaction.message.guildId, 'user=', user.id, 'emoji=', emojiKey);
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
  if (user.bot) return;
  if (!reaction.message.guildId) return;

  const emojiKey = normalizeEmojiKey(reaction.emoji);
  console.log('[REACTION_REMOVE] user=', user.id, 'emoji=', reaction.emoji?.name ?? reaction.emoji?.id, 'key=', emojiKey, 'tracked=', isTrackedEmojiKey(emojiKey));

  if (!emojiKey || !isTrackedEmojiKey(emojiKey)) return;

  incrementReactionCount({
    guildId: reaction.message.guildId,
    userId: user.id,
    emoji: emojiKey,
    delta: -1,
  });

  console.log('[REACTION_REMOVE_DB] saved for guild=', reaction.message.guildId, 'user=', user.id, 'emoji=', emojiKey);
});

client.on(Events.InteractionCreate, async (interaction) => {
  console.log('[INTERACTION] commandName=', interaction.commandName, 'user=', interaction.user?.id, 'guild=', interaction.guildId, 'type=', interaction.type);

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'countreaction') {
    await interaction.deferReply({ ephemeral: true });

    const messageId = interaction.options.getString('message_id');

    if (!messageId) {
      await interaction.editReply({ content: 'Tu dois fournir un message_id.' });
      return;
    }

    const channel = interaction.channel;
    if (!channel || !channel.messages) {
      await interaction.editReply({ content: 'Impossible de lire ce canal.' });
      return;
    }

    try {
      const message = await channel.messages.fetch(messageId);
      const reaction = message.reactions.cache.find((entry) => normalizeEmojiKey(entry.emoji) === TARGET_EMOJI_KEY);
      const total = reaction ? reaction.count : 0;

      await interaction.editReply({
        content: `Le bot compte uniquement <:DISBIEN:${TARGET_EMOJI_ID}>. Sur ce message, il a été utilisé ${total} fois.`,
      });
    } catch (error) {
      console.error('Error counting reaction:', error);
      await interaction.editReply({ content: 'Impossible de compter cette réaction sur ce message.' });
    }

    return;
  }

  if (interaction.commandName === 'dbranking') {
    await interaction.deferReply({ ephemeral: false });

    try {
      console.log('[DBRANKING] command called by user=', interaction.user.id, 'guild=', interaction.guildId);

      const guildId = interaction.guildId;
      const userId = interaction.user.id;
      const ranking = getRankingByEmoji(guildId, TARGET_EMOJI_KEY, 10);
      const userStats = getUserRank(guildId, userId, TARGET_EMOJI_KEY);

      console.log('[DBRANKING] ranking=', JSON.stringify(ranking));
      console.log('[DBRANKING] userStats=', JSON.stringify(userStats));

      const lines = [`Top 10 <:DISBIEN:${TARGET_EMOJI_ID}>`];

      if (!ranking.length) {
        lines.push('Aucune donnée pour l’instant.');
      } else {
        ranking.forEach((entry, index) => {
          lines.push(`${index + 1}. <@${entry.user_id}> — ${entry.total}`);
        });
      }

      if (userStats.rank) {
        lines.push(`\nTon classement : #${userStats.rank} avec ${userStats.total} <:DISBIEN:${TARGET_EMOJI_ID}>`);
      } else {
        lines.push(`\nTon classement : pas encore dans le classement pour <:DISBIEN:${TARGET_EMOJI_ID}>`);
      }

      await interaction.editReply({ content: lines.join('\n'), allowedMentions: { parse: [] } });
    } catch (error) {
      console.error('Error in dbranking command:', error);
      await interaction.editReply({ content: 'Une erreur est survenue pendant le calcul du classement.' });
    }
    return;
  }

  if (interaction.commandName === 'resetdnranking') {
    await interaction.deferReply({ ephemeral: false });

    if (!interaction.guildId || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.editReply({ content: 'Tu dois être admin pour réinitialiser le classement.' });
      return;
    }

    const deleted = resetRankingForEmoji(interaction.guildId, TARGET_EMOJI_KEY);
    await interaction.editReply({
      content: `Le classement a été réinitialisé pour <:DISBIEN:${TARGET_EMOJI_ID}>. ${deleted} entrées supprimées.`,
    });
  }
});

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('[LOGIN_ERROR]', error);
  process.exit(1);
});
