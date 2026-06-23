require('dotenv').config(); // เพิ่มบรรทัดนี้ที่ด้านบนสุดของไฟล์
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is alive!');
});

app.listen(port, () => {
  console.log(`Web server listening on port ${port}`);
});
const { Client, GatewayIntentBits, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder, REST, Routes, ActivityType } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

// เก็บสถานะคำถามในแต่ละห้อง
// { channelId: { question, answererId, questionMessageId, buttonMessageId, active } }
const quizSessions = new Map();

// ==================== REGISTER SLASH COMMANDS ====================
// แก้ไข registerCommands ให้เป็นแบบนี้ครับ
async function registerCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('question')
            .setDescription('โพสต์คำถามสำหรับ Quiz')
            .addStringOption(opt =>
                opt.setName('text')
                    .setDescription('คำถามที่ต้องการถาม')
                    .setRequired(true)
            )
            // ลบบรรทัด .setDefaultMemberPermissions(...) ออกไปเลยครับ!
            .toJSON(),

        new SlashCommandBuilder()
            .setName('endquiz')
            .setDescription('จบ Quiz ในห้องนี้')
            // ลบบรรทัด .setDefaultMemberPermissions(...) ออกไปเลยครับ!
            .toJSON(),
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    // ... ส่วนที่เหลือของ rest ...
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('✅ Slash commands registered');
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
  }
}

// ==================== HELPERS ====================

/** ล็อคห้อง: ไม่ให้ @everyone ส่งข้อความ */
async function lockChannel(channel) {
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
    SendMessages: false,
  });
}

/** เปิดห้องให้เฉพาะ userId ส่งข้อความได้ */
async function openChannelForUser(channel, userId) {
  // ล็อค @everyone ก่อน
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
    SendMessages: false,
  });
  // เปิดให้ user นั้น
  await channel.permissionOverwrites.edit(userId, {
    SendMessages: true,
  });
}

/** รีเซ็ต permission ห้องกลับปกติ */
async function resetChannel(channel) {
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
    SendMessages: null,
  });
  // ลบ override ของผู้ใช้ทุกคน (ยกเว้น role)
  for (const [id, overwrite] of channel.permissionOverwrites.cache) {
    if (overwrite.type === 1) { // type 1 = member
      await channel.permissionOverwrites.delete(id);
    }
  }
}

/** สร้าง Embed แสดงคำถาม */
function buildQuestionEmbed(question, round = 1) {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('❓ คำถาม Quiz!')
    .setDescription(`**${question}**`)
    .addFields({ name: 'รอบที่', value: `${round}`, inline: true })
    .setFooter({ text: 'กดปุ่ม "🙋 ตอบ!" เพื่อแย่งตอบ' })
    .setTimestamp();
}

/** สร้างปุ่ม "กดตอบ" */
function buildAnswerButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('quiz_answer')
      .setLabel('🙋 ตอบ!')
      .setStyle(ButtonStyle.Primary)
  );
}

/** สร้างปุ่ม ถูก/ผิด สำหรับ Admin */
function buildJudgeButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('quiz_correct')
      .setLabel('✅ ถูก!')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('quiz_wrong')
      .setLabel('❌ ผิด')
      .setStyle(ButtonStyle.Danger)
  );
}

// ==================== EVENT: READY ====================
client.once('ready', async () => {
  console.log(`🤖 Bot พร้อมแล้ว: ${client.user.tag}`);
  await registerCommands();
  // ตั้งสถานะตรงนี้เลย!
    client.user.setActivity('เกมส์ตอบคำถาม | /question', { 
        type: ActivityType.Competing // หรือใช้ Playing, Watching, Competing ตามใจชอบ
    });
    
});

// ==================== EVENT: SLASH COMMANDS ====================
client.on('interactionCreate', async (interaction) => {

// ── /question ──────────────────────────────────────────────────
if (interaction.isChatInputCommand() && interaction.commandName === 'question') {
    
    // --- เพิ่มการเช็คสิทธิ์ตรงนี้ ---
    const adminRoleId = '1508699693486575707'; // <--- ใส่ ID โรล Admin ของคุณ
    const isOwner = interaction.member.id === interaction.guild.ownerId; // เช็คว่าเป็นเจ้าของมั้ย
    const hasAdminRole = interaction.member.roles.cache.has(adminRoleId); // เช็คว่ามีโรล Admin มั้ย

    // ถ้าไม่ใช่เจ้าของ และไม่มีโรล Admin -> ให้เด้งออก
    if (!isOwner && !hasAdminRole) {
        return interaction.reply({ content: '🚫 คุณไม่มีสิทธิ์ใช้งานคำสั่งนี้!', ephemeral: true });
    }
    // ----------------------------

    const channel = interaction.channel;
    const question = interaction.options.getString('text');

    // ถ้ามี session อยู่แล้ว ไม่ให้สร้างใหม่
    if (quizSessions.has(channel.id)) {
      return interaction.reply({ content: '⚠️ ยังมี Quiz ค้างอยู่ในห้องนี้ ใช้ `/endquiz` ก่อนนะ', ephemeral: true });
    }

    await interaction.reply({ content: '📢 กำลังสร้างคำถาม...', ephemeral: true });

    // ล็อคห้องก่อน
    await lockChannel(channel);

    // ส่ง embed คำถาม + ปุ่มตอบ
    const embed = buildQuestionEmbed(question);
    const row = buildAnswerButton();
    const msg = await channel.send({ content: '@everyone', embeds: [embed], components: [row] });

    quizSessions.set(channel.id, {
      question,
      answererId: null,
      buttonMessageId: msg.id,
      round: 1,
      active: true,
      adminId: interaction.user.id,
    });

    console.log(`[Quiz] ห้อง ${channel.name} | คำถาม: ${question}`);
  }

  // ── /endquiz ───────────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === 'endquiz') {
    const channel = interaction.channel;
    const session = quizSessions.get(channel.id);

    if (!session) {
      return interaction.reply({ content: '⚠️ ไม่มี Quiz ในห้องนี้', ephemeral: true });
    }

    // ลบ session และ reset ห้อง
    quizSessions.delete(channel.id);
    await resetChannel(channel);

    // แก้ไขข้อความปุ่มให้ disabled
    try {
      const btnMsg = await channel.messages.fetch(session.buttonMessageId);
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('quiz_ended').setLabel('🔒 Quiz จบแล้ว').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );
      await btnMsg.edit({ components: [disabledRow] });
    } catch (_) {}

    await interaction.reply({ content: '✅ จบ Quiz แล้ว ห้องเปิดปกติแล้ว' });
    console.log(`[Quiz] ห้อง ${channel.name} จบ Quiz`);
  }

  // ── BUTTON: quiz_answer ────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'quiz_answer') {
    const channel = interaction.channel;
    const session = quizSessions.get(channel.id);

    if (!session || !session.active) {
      return interaction.reply({ content: '⚠️ ไม่มี Quiz ที่กำลังเปิดอยู่', ephemeral: true });
    }

    if (session.answererId) {
      return interaction.reply({ content: '⏰ มีคนกดทันแล้ว! รอรอบหน้านะ', ephemeral: true });
    }

    // ล็อคคนนี้เป็นผู้ตอบ
    session.answererId = interaction.user.id;

    // เปิดห้องให้เฉพาะคนนี้พิมพ์
    await openChannelForUser(channel, interaction.user.id);

    // อัปเดตปุ่มเป็น ถูก/ผิด
    const judgeRow = buildJudgeButtons();
    await interaction.update({ components: [judgeRow] });

    // แจ้งในห้อง
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFEE75C)
          .setDescription(`🏃 **${interaction.user.displayName}** กดทัน! กำลังพิมพ์คำตอบ...`)
      ]
    });

    console.log(`[Quiz] ${interaction.user.tag} กดตอบในห้อง ${channel.name}`);
  }

  // ── BUTTON: quiz_correct ───────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'quiz_correct') {
    const channel = interaction.channel;
    const session = quizSessions.get(channel.id);

    if (!session) return interaction.reply({ content: '⚠️ ไม่มี Session', ephemeral: true });

    // เฉพาะ Admin เท่านั้น
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: '🚫 เฉพาะ Admin เท่านั้น', ephemeral: true });
    }

    const winnerId = session.answererId;
    quizSessions.delete(channel.id);

    // Reset ห้อง
    await resetChannel(channel);

    // Disable ปุ่ม
    const doneRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('quiz_done').setLabel('🎉 มีผู้ตอบถูก!').setStyle(ButtonStyle.Success).setDisabled(true)
    );
    await interaction.update({ components: [doneRow] });

    // ประกาศผู้ชนะ
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('🎉 ถูกต้อง!')
          .setDescription(`<@${winnerId}> ตอบถูก! ยินดีด้วย 🏆`)
          .setTimestamp()
      ]
    });

    console.log(`[Quiz] ห้อง ${channel.name} มีผู้ตอบถูก: ${winnerId}`);
  }

  // ── BUTTON: quiz_wrong ─────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'quiz_wrong') {
    const channel = interaction.channel;
    const session = quizSessions.get(channel.id);

    if (!session) return interaction.reply({ content: '⚠️ ไม่มี Session', ephemeral: true });

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: '🚫 เฉพาะ Admin เท่านั้น', ephemeral: true });
    }

    const wrongAnswererId = session.answererId;
    session.answererId = null;
    session.round += 1;

    // ล็อคห้องอีกครั้ง + ลบ override ของคนผิด
    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: false });
    try {
      await channel.permissionOverwrites.delete(wrongAnswererId);
    } catch (_) {}

    // อัปเดตกลับเป็นปุ่ม "ตอบ!"
    const row = buildAnswerButton();
    await interaction.update({ components: [row] });

    // แจ้งในห้อง
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription(`❌ <@${wrongAnswererId}> ตอบผิด! รอบที่ ${session.round} — กดปุ่มด้านบนเพื่อตอบ!`)
      ]
    });

    console.log(`[Quiz] ห้อง ${channel.name} | ${wrongAnswererId} ตอบผิด รอบที่ ${session.round}`);
  }
});

// ==================== START ====================
client.login(process.env.DISCORD_TOKEN);
