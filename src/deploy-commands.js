require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const admin = PermissionFlagsBits.ManageGuild;
const commands = [
 new SlashCommandBuilder().setName('giveaway-start').setDescription('Start a timed giveaway')
  .addStringOption(o=>o.setName('prize').setDescription('What is the prize?').setRequired(true).setMaxLength(200))
  .addStringOption(o=>o.setName('duration').setDescription('Examples: 30s, 30m, 2h, 1d (max 30 days)').setRequired(true))
  .addIntegerOption(o=>o.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(20))
  .addChannelOption(o=>o.setName('channel').setDescription('Channel to post the giveaway in'))
  .setDefaultMemberPermissions(admin),
 new SlashCommandBuilder().setName('giveaway-end').setDescription('End a giveaway early and pick winner(s)')
  .addStringOption(o=>o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)).setDefaultMemberPermissions(admin),
 new SlashCommandBuilder().setName('giveaway-reroll').setDescription('Pick new winner(s) for an ended giveaway')
  .addStringOption(o=>o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)).setDefaultMemberPermissions(admin),
 new SlashCommandBuilder().setName('giveaway-info').setDescription('Show details and entry count for a giveaway')
  .addStringOption(o=>o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)).setDefaultMemberPermissions(admin),
 new SlashCommandBuilder().setName('giveaway-list').setDescription('List active giveaways on this server').setDefaultMemberPermissions(admin),
 new SlashCommandBuilder().setName('giveaway-cancel').setDescription('Cancel a giveaway without selecting a winner')
  .addStringOption(o=>o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)).setDefaultMemberPermissions(admin)
].map(c=>c.toJSON());
if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) throw new Error('Fill in DISCORD_TOKEN, CLIENT_ID, and GUILD_ID in .env');
new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN).put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {body:commands})
 .then(()=>console.log('Giveaway slash commands registered.')).catch(console.error);
