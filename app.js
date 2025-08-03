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
    const player = {};

    const parseNumber = (str) => {
      const match = str.match(/(\d{2,3})$/);
      return match ? parseInt(match[1], 10) : str;
    };

    player["Player Name"] = $('h1').first().text().trim();

    // General info
    const table = $('table').first();
    table.find('tr').each((_, el) => {
      const key = $(el).find('th').text().trim().replace(/:$/, '');
      const val = $(el).find('td').text().trim();
      if (key && val) {
        player[key] = parseNumber(val);
      }
    });

    // Ratings block
    const ratingLabels = [
      'Overall Rating', 'Offensive Awareness', 'Ball Control', 'Dribbling', 'Tight Possession',
      'Low Pass', 'Lofted Pass', 'Finishing', 'Heading', 'Set Piece Taking', 'Curl',
      'Defensive Awareness', 'Tackling', 'Aggression', 'Defensive Engagement',
      'GK Awareness', 'GK Catching', 'GK Parrying', 'GK Reflexes', 'GK Reach',
      'Speed', 'Acceleration', 'Kicking Power', 'Jumping', 'Physical Contact',
      'Balance', 'Stamina'
    ];

    const footLabels = ['Weak Foot Usage', 'Weak Foot Accuracy', 'Form', 'Injury Resistance'];
    let currentLabel = 0, currentFoot = 0;

    $('table').eq(1).find('tr td').each((_, td) => {
      const text = $(td).text().trim();
      if (!text) return;

      if (currentLabel < ratingLabels.length) {
        player[ratingLabels[currentLabel]] = parseNumber(text);
        currentLabel++;
      } else if (currentFoot < footLabels.length) {
        player[footLabels[currentFoot]] = text;
        currentFoot++;
      }
    });

    // Playing Style
    const playstyle = $('td[colspan="2"]')
      .find('h3:contains("Playing Style")')
      .next()
      .text()
      .trim();
    player["Playing Style"] = playstyle;

    // Player Skills
    const skills = [];
    $('h3:contains("Player Skills")').nextUntil('h3').each((_, el) => {
      const skill = $(el).text().trim();
      if (skill) skills.push(skill);
    });
    player["Player Skills"] = skills;

    // AI Playing Styles
    const aiStyles = [];
    $('h3:contains("AI Playing Styles")').nextUntil('h3').each((_, el) => {
      const ai = $(el).text().trim();
      if (ai) aiStyles.push(ai);
    });
    player["AI Playing Styles"] = aiStyles;

    // Card image
    const cardBox = $('td[colspan="2"] .flip-box-inner');
    if (cardBox.length) {
      player['Card Front'] = cardBox.find('.flip-box-front img').attr('src') || null;
      player['Card Back'] = cardBox.find('.flip-box-back img').attr('src') || null;
      const cardType = cardBox.closest('td').text().trim().split('\n').pop().trim();
      player['Card Type'] = cardType || null;
    }

    return res.json(player);

  } catch (err) {
    console.error('Scrape error:', err.message);
    res.status(500).json({ error: 'Failed to fetch or parse player data.' });
  }
});

app.listen(PORT, () => {
  console.log(`🟢 Server running at http://localhost:${PORT}`);
});
