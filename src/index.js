require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, PermissionFlagsBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const STORE = path.join(__dirname, '..', 'giveaways.json');
const active = new Map();
const ended = new Map();

function loadStore() {
  try { const d = JSON.parse(fs.readFileSync(STORE, 'utf8')); for (const g of d.active || []) active.set(g.messageId, { ...g, entrants: new Set(g.entrants || []), timer: null }); for (const g of d.ended || []) ended.set(g.messageId, { ...g, entrants: new Set(g.entrants || []), timer: null }); }
  catch (e) { if (e.code !== 'ENOENT') console.error('Could not read giveaways.json:', e); }
}
function saveStore() {
  const serial = m => [...m.values()].map(g => ({ ...g, entrants: [...g.entrants], timer: undefined }));
  const tmp = STORE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({ active: serial(active), ended: serial(ended) }, null, 2)); fs.renameSync(tmp, STORE);
}
function parseDuration(s) {
  const m = /^([1-9]\d*)(s|m|h|d)$/i.exec((s || '').trim()); if (!m) return null;
  const ms = Number(m[1]) * ({s:1000,m:60000,h:3600000,d:86400000}[m[2].toLowerCase()]);
  return ms >= 10000 && ms <= 30 * 86400000 ? ms : null;
}
function entryRow(id, disabled = false) { return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`giveaway-enter:${id}`).setLabel('Enter Giveaway').setEmoji('🎉').setStyle(ButtonStyle.Primary).setDisabled(disabled)); }
function findData(id) { return active.get(id) || ended.get(id); }
async function getMessage(guild, data) {
  const channel = await guild.channels.fetch(data.channelId).catch(() => null);
  const message = channel?.isTextBased() ? await channel.messages.fetch(data.messageId).catch(() => null) : null;
  return { channel, message };
}
async function finish(guild, messageId, reroll = false) {
  const data = findData(messageId); if (!data) return { ok: false, message: 'Giveaway not found. Check the message ID.' };
  if (reroll && active.has(messageId)) return { ok: false, message: 'This giveaway has not ended yet. Use /giveaway-end first if needed.' };
  if (!reroll && !active.has(messageId)) return { ok: false, message: 'This giveaway has already ended. Use /giveaway-reroll to pick a new winner.' };
  const { channel, message } = await getMessage(guild, data);
  if (!channel || !message) return { ok: false, message: 'Could not find the giveaway message/channel. Check bot permissions.' };
  const entrants = [...data.entrants];
  if (!entrants.length) {
    if (!reroll) { clearTimeout(data.timer); active.delete(messageId); data.endedAt = Date.now(); ended.set(messageId, data); saveStore(); await message.edit({ embeds: [new EmbedBuilder().setColor(0x777777).setTitle('🎁 Giveaway Ended').setDescription(`**Prize:** ${data.prize}\nNo valid entries were received.`)], components: [entryRow(messageId, true)] }); await channel.send(`🎁 The giveaway for **${data.prize}** has ended, but nobody entered. Better luck next time!`); }
    return { ok: true, message: 'No entrants to pick from.' };
  }
  const pool = [...entrants]; const winners = [];
  for (let i = 0; i < Math.min(data.winnerCount, pool.length); i++) winners.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  if (!reroll) {
    clearTimeout(data.timer); active.delete(messageId); data.endedAt = Date.now(); data.winnerIds = winners; ended.set(messageId, data); saveStore();
    await message.edit({ embeds: [new EmbedBuilder().setColor(0x777777).setTitle('🎁 Giveaway Ended').setDescription(`**Prize:** ${data.prize}\n**Winner${winners.length === 1 ? '' : 's'}:** ${winners.map(x => `<@${x}>`).join(', ')}\n**Entries:** ${entrants.length}\n**Hosted by:** <@${data.hostId}>`).setFooter({ text: 'Streamer Community • Congratulations!' })], components: [entryRow(messageId, true)] });
    await channel.send({ content: `🎉 **GIVEAWAY WINNER${winners.length === 1 ? '' : 'S'}!** Congratulations ${winners.map(x => `<@${x}>`).join(', ')}! You ${winners.length === 1 ? 'have' : 'have'} won **${data.prize}**! 🎁\nPlease contact the giveaway host to claim your prize.`, allowedMentions: { users: winners } });
  } else {
    data.winnerIds = winners; saveStore();
    await channel.send({ content: `🔄 **GIVEAWAY REROLL!** Congratulations ${winners.map(x => `<@${x}>`).join(', ')}! You won **${data.prize}** in the reroll! 🎉`, allowedMentions: { users: winners } });
  }
  return { ok: true, message: `Winner${winners.length === 1 ? '' : 's'}: ${winners.map(x => `<@${x}>`).join(', ')}` };
}
async function resumeTimers() {
  for (const [id, data] of active) {
    const remaining = data.endsAt - Date.now();
    if (remaining <= 0) finish(await client.guilds.fetch(data.guildId).catch(() => null), id).catch(console.error);
    else data.timer = setTimeout(async () => { const guild = await client.guilds.fetch(data.guildId).catch(() => null); if (guild) await finish(guild, id).catch(console.error); }, remaining);
  }
}
loadStore();
client.once(Events.ClientReady, async c => { console.log(`Giveaway bot online as ${c.user.tag}`); await resumeTimers(); });
client.on(Events.InteractionCreate, async i => {
 try {
  if (i.isChatInputCommand()) {
   if (i.commandName === 'giveaway-start') {
    const ms = parseDuration(i.options.getString('duration'));
    if (!ms) return i.reply({ content: 'Use `10s`, `30m`, `2h`, or `1d` (10 seconds to 30 days).', ephemeral: true });
    const channel = i.options.getChannel('channel') || (process.env.GIVEAWAY_CHANNEL_ID ? await i.guild.channels.fetch(process.env.GIVEAWAY_CHANNEL_ID).catch(() => null) : i.channel);
    if (!channel || !channel.isTextBased() || !channel.permissionsFor(client.user).has(['ViewChannel','SendMessages','EmbedLinks','ReadMessageHistory'])) return i.reply({ content: 'Choose a text channel where I can view, send messages, embed links, and read history.', ephemeral: true });
    const prize = i.options.getString('prize'); const winnerCount = i.options.getInteger('winners') || 1; const endsAt = Date.now() + ms;
    const embed = new EmbedBuilder().setColor(0x8b35ff).setTitle('🎁 GIVEAWAY').setDescription(`**Prize:** ${prize}\n**Hosted by:** ${i.user}\n**Winners:** ${winnerCount}\n**Ends:** <t:${Math.floor(endsAt / 1000)}:F> (<t:${Math.floor(endsAt / 1000)}:R>)\n\nClick **Enter Giveaway** below to participate!`).setFooter({ text: 'Streamer Community • Good luck!' }).setTimestamp(endsAt);
    const msg = await channel.send({ embeds: [embed], components: [entryRow('pending')] }); await msg.edit({ components: [entryRow(msg.id)] });
    const data = { messageId: msg.id, guildId: i.guildId, channelId: channel.id, hostId: i.user.id, prize, winnerCount, endsAt, entrants: new Set(), timer: null, createdAt: Date.now() };
    data.timer = setTimeout(() => finish(i.guild, msg.id).catch(console.error), ms); active.set(msg.id, data); saveStore();
    return i.reply({ content: `🎉 Giveaway started in ${channel}: ${msg.url}\nEnds <t:${Math.floor(endsAt / 1000)}:R>.`, ephemeral: true });
   }
   if (i.commandName === 'giveaway-end') { const r = await finish(i.guild, i.options.getString('message_id')); return i.reply({ content: r.message, ephemeral: true }); }
   if (i.commandName === 'giveaway-reroll') { const r = await finish(i.guild, i.options.getString('message_id'), true); return i.reply({ content: r.message, ephemeral: true }); }
   if (i.commandName === 'giveaway-info') {
    const id = i.options.getString('message_id'); const d = findData(id);
    if (!d || d.guildId !== i.guildId) return i.reply({ content: 'Giveaway not found for this server.', ephemeral: true });
    return i.reply({ content: `🎁 **${d.prize}**\nStatus: ${active.has(id) ? 'Active' : 'Ended'}\nEntries: **${d.entrants.size}**\nWinners: **${d.winnerCount}**\nEnds: <t:${Math.floor(d.endsAt / 1000)}:R>\nMessage ID: \`${id}\``, ephemeral: true });
   }
   if (i.commandName === 'giveaway-list') {
    const rows = [...active.values()].filter(d => d.guildId === i.guildId);
    return i.reply({ content: rows.length ? rows.map(d => `• **${d.prize}** — <#${d.channelId}> — ${d.entrants.size} entries — ends <t:${Math.floor(d.endsAt / 1000)}:R> — ID \`${d.messageId}\``).join('\n') : 'There are no active giveaways on this server.', ephemeral: true });
   }
   if (i.commandName === 'giveaway-cancel') {
    const id = i.options.getString('message_id'); const d = active.get(id);
    if (!d || d.guildId !== i.guildId) return i.reply({ content: 'Active giveaway not found.', ephemeral: true });
    clearTimeout(d.timer); active.delete(id); ended.set(id, d); saveStore();
    const { channel, message } = await getMessage(i.guild, d);
    if (message) await message.edit({ embeds: [new EmbedBuilder().setColor(0x777777).setTitle('🎁 Giveaway Cancelled').setDescription(`**Prize:** ${d.prize}\nThis giveaway was cancelled by ${i.user}.`)], components: [entryRow(id, true)] });
    if (channel) await channel.send(`⚠️ The giveaway for **${d.prize}** was cancelled by ${i.user}.`);
    return i.reply({ content: 'Giveaway cancelled.', ephemeral: true });
   }
  }
  if (i.isButton() && i.customId.startsWith('giveaway-enter:')) {
   const id = i.customId.split(':')[1]; const data = active.get(id);
   if (!data || data.endsAt <= Date.now()) return i.reply({ content: 'This giveaway has ended. Good luck next time!', ephemeral: true });
   if (data.guildId !== i.guildId) return i.reply({ content: 'This giveaway belongs to another server.', ephemeral: true });
   if (data.entrants.has(i.user.id)) return i.reply({ content: 'You have already entered! 💜', ephemeral: true });
   data.entrants.add(i.user.id); saveStore(); return i.reply({ content: '🎉 You are entered in the giveaway. Good luck!', ephemeral: true });
  }
 } catch (e) { console.error(e); if (i.isRepliable() && !i.replied && !i.deferred) await i.reply({ content: 'Something went wrong. Check the bot logs and permissions.', ephemeral: true }).catch(() => {}); }
});
if (!process.env.DISCORD_TOKEN) throw new Error('Missing DISCORD_TOKEN in .env');
client.login(process.env.DISCORD_TOKEN);
