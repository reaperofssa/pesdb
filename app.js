const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/player', async (req, res) => {
  const playerId = req.query.playerid;
  if (!playerId) return res.status(400).json({ error: 'Missing playerid in query' });

  const URL = `https://pesdb.net/efootball/?id=${playerId}&mode=max_level`;

  try {
    const { data: html } = await axios.get(URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const $ = cheerio.load(html);
    const data = {};

    // Player name
    data['Player Name'] = $('h1').first().text().trim();

    // Structured stats from main table
    $('table tr').each((_, row) => {
      const th = $(row).find('th').text().trim().replace(/:$/, '');
      const td = $(row).find('td').text().trim();
      if (th && td) data[th] = isNaN(td) ? td : Number(td);
    });

    // Stats block (second table)
    const statsBlock = {};
    const statKeys = [
      "Overall Rating", "Offensive Awareness", "Ball Control", "Dribbling", "Tight Possession",
      "Low Pass", "Lofted Pass", "Finishing", "Heading", "Set Piece Taking", "Curl",
      "Defensive Awareness", "Tackling", "Aggression", "Defensive Engagement",
      "GK Awareness", "GK Catching", "GK Parrying", "GK Reflexes", "GK Reach",
      "Speed", "Acceleration", "Kicking Power", "Jumping", "Physical Contact",
      "Balance", "Stamina", "Weak Foot Usage", "Weak Foot Accuracy", "Form", "Injury Resistance"
    ];

    let statIndex = 0;
    $('table').eq(1).find('td').each((_, td) => {
      const val = $(td).text().trim();
      if (val && statIndex < statKeys.length) {
        const key = statKeys[statIndex++];
        statsBlock[key] = isNaN(val) ? val : Number(val);
      }
    });

    Object.assign(data, statsBlock);

    // Playing Style
    const playStyle = $('h3:contains("Playing Style")').next().text().trim();
    data["Playing Style"] = playStyle || null;

    // Player Skills
    const skills = [];
    $('h3:contains("Player Skills")').nextUntil('h3').each((_, el) => {
      const skill = $(el).text().trim();
      if (skill) skills.push(skill);
    });
    data["Player Skills"] = skills;

    // AI Playing Styles
    const aiStyles = [];
    $('h3:contains("AI Playing Styles")').nextUntil('h3').each((_, el) => {
      const ai = $(el).text().trim();
      if (ai) aiStyles.push(ai);
    });
    data["AI Playing Styles"] = aiStyles;

    // Card Front / Back / Type
    const cardBox = $('td[colspan="2"] .flip-box-inner');
    if (cardBox.length) {
      data['Card Front'] = cardBox.find('.flip-box-front img').attr('src') || null;
      data['Card Back'] = cardBox.find('.flip-box-back img').attr('src') || null;
      const cardType = cardBox.closest('td').text().trim().split('\n').pop().trim();
      data['Card Type'] = cardType || null;
    }

    // Remove junk keys like this malformed key
    Object.keys(data).forEach(k => {
      if (k.length > 60 || k.includes('Share this player')) delete data[k];
    });

    res.json(data);
  } catch (err) {
    console.error('❌ Scrape error:', err.message);
    res.status(500).json({ error: 'Failed to fetch or parse player data.' });
  }
});

app.listen(PORT, () => {
  console.log(`🟢 Server running at http://localhost:${PORT}`);
});
