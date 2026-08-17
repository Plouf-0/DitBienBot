import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';

const dbPath = fileURLToPath(new URL('./data/db.sqlite', import.meta.url));
const db = new Database(dbPath);

export const TARGET_EMOJI_ID = '1535291511174991952';
export const TARGET_EMOJI_KEY = `custom:${TARGET_EMOJI_ID}`;

const TRACKED_EMOJIS = new Set([TARGET_EMOJI_KEY]);

db.exec(`
  CREATE TABLE IF NOT EXISTS reaction_counts (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    total INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id, emoji)
  );
`);

export function normalizeEmojiKey(emoji) {
    if (!emoji) return null;

    if (emoji.id) {
        return `custom:${emoji.id}`;
    }

    if (emoji.name) {
        return `unicode:${emoji.name}`;
    }

    return null;
}

export function isTrackedEmojiKey(emojiKey) {
    return TRACKED_EMOJIS.has(emojiKey);
}

export function incrementReactionCount({ guildId, userId, emoji, delta }) {
    if (!guildId || !userId || !emoji || !isTrackedEmojiKey(emoji)) {
        return;
    }

    db.prepare(`
    INSERT INTO reaction_counts (guild_id, user_id, emoji, total)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, user_id, emoji)
    DO UPDATE SET total = total + excluded.total
  `).run(guildId, userId, emoji, delta || 0);
}

export function getRankingByEmoji(guildId, emoji, limit = 10) {
    return db.prepare(`
    SELECT user_id, total
    FROM reaction_counts
    WHERE guild_id = ? AND emoji = ?
    ORDER BY total DESC, user_id ASC
    LIMIT ?
  `).all(guildId, emoji, limit);
}

export function getUserRank(guildId, userId, emoji) {
    const allRanking = db.prepare(`
    SELECT user_id, total
    FROM reaction_counts
    WHERE guild_id = ? AND emoji = ?
    ORDER BY total DESC, user_id ASC
  `).all(guildId, emoji);

    const index = allRanking.findIndex((entry) => entry.user_id === userId);

    if (index === -1) {
        return { rank: null, total: 0 };
    }

    return {
        rank: index + 1,
        total: allRanking[index].total,
    };
}

export function resetRankingForEmoji(guildId, emoji) {
    const result = db.prepare(`
      DELETE FROM reaction_counts
      WHERE guild_id = ? AND emoji = ?
    `).run(guildId, emoji);

    return result.changes || 0;
}

