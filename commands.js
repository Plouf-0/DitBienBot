import 'dotenv/config';
import { REST, Routes } from 'discord.js';

const commands = [
  {
    name: 'dbranking',
    description: 'Affiche le top 10 du nombre de <:DISBIEN:1535291511174991952> par utilisateur',
  },
  {
    name: 'countreaction',
    description: 'Compte uniquement les <:DISBIEN:1535291511174991952> sur un message précis',
    options: [
      {
        name: 'message_id',
        description: 'ID du message à vérifier',
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: 'resetdnranking',
    description: 'Réinitialise le classement du bot pour cet emoji (admin uniquement)',
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

const target = process.env.GUILD_ID
  ? Routes.applicationGuildCommands(process.env.APP_ID, process.env.GUILD_ID)
  : Routes.applicationCommands(process.env.APP_ID);

try {
  await rest.put(target, { body: commands });
  console.log('Slash commands registered successfully.');
} catch (error) {
  console.error('Error registering slash commands:', error);
  process.exit(1);
}
