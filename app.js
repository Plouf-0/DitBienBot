import 'dotenv/config';
import { Client, Events, GatewayIntentBits, Partials, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
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
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
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

  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (err) {
      console.error('Impossible de fetch la réaction partielle:', err);
      return;
    }
  }

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

  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (err) {
      console.error('Impossible de fetch la réaction partielle:', err);
      return;
    }
  }

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

  if (interaction.commandName === 'dbranking') {
    await interaction.deferReply({ ephemeral: false });

    try {
      console.log('[DBRANKING] command called by user=', interaction.user.id, 'guild=', interaction.guildId);

      const medals = ['🥇', '🥈', '🥉'];
      const guildId = interaction.guildId;
      const userId = interaction.user.id;
      const ranking = getRankingByEmoji(guildId, TARGET_EMOJI_KEY, 10);
      const userStats = getUserRank(guildId, userId, TARGET_EMOJI_KEY);

      const description = ranking.length
        ? ranking.map((entry, index) => {
          const prefix = medals[index] ?? `**${index + 1}.**`;
          return `${prefix} <@${entry.user_id}> — **${entry.total}**`;
        }).join('\n')
        : 'Aucune donnée pour l\'instant.';

      const embed = new EmbedBuilder()
        .setColor(0xD85A30)
        .setTitle(`🏆 Classement <:DISBIEN:${TARGET_EMOJI_ID}>`)
        .setDescription(description)
        .setFooter({
          text: userStats.rank
            ? `Ton classement : #${userStats.rank} avec ${userStats.total} DISBIEN`
            : 'Tu n\'es pas encore dans le classement',
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
    } catch (error) {
      console.error('Error in dbranking command:', error);
      await interaction.editReply({ content: 'Une erreur est survenue pendant le calcul du classement.' });
    }
    return;
  }

  if (interaction.commandName === 'resetdbranking') {
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
