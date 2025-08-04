const fs = require('fs');
const path = require('path');
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

    data['Player Name'] = $('h1').first().text().trim();

    $('table tr').each((_, row) => {
      const th = $(row).find('th').text().trim().replace(/:$/, '');
      const td = $(row).find('td').text().trim();
      if (th && td) data[th] = isNaN(td) ? td : Number(td);
    });

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

    const playStyle = $('h3:contains("Playing Style")').next().text().trim();
    data["Playing Style"] = playStyle || null;

    const skills = [];
    $('h3:contains("Player Skills")').nextUntil('h3').each((_, el) => {
      const skill = $(el).text().trim();
      if (skill) skills.push(skill);
    });
    data["Player Skills"] = skills;

    const aiStyles = [];
    $('h3:contains("AI Playing Styles")').nextUntil('h3').each((_, el) => {
      const ai = $(el).text().trim();
      if (ai) aiStyles.push(ai);
    });
    data["AI Playing Styles"] = aiStyles;

    const cardBox = $('td[colspan="2"] .flip-box-inner');
    if (cardBox.length) {
      data['Card Front'] = cardBox.find('.flip-box-front img').attr('src') || null;
      data['Card Back'] = cardBox.find('.flip-box-back img').attr('src') || null;
      const cardType = cardBox.closest('td').text().trim().split('\n').pop().trim();
      data['Card Type'] = cardType || null;
    }

    Object.keys(data).forEach(k => {
      if (k.toLowerCase().includes('twitter') || k.length > 60 || k.includes('Share this player')) {
        delete data[k];
      }
    });

    res.json(data);
  } catch (err) {
    console.error('❌ Scrape error:', err.message);
    res.status(500).json({ error: 'Failed to fetch or parse player data.' });
  }
});


const positionsNeeded = {
  GK: 1,
  CB: 2,
  LB: 1,
  RB: 1,
  DMF: 1,
  AMF: 2,
  RWF: 2,
  CF: 2,
};

const posMap = {
  "Goalkeeper": "GK",
  "Centre Back": "CB",
  "Left Back": "LB",
  "Right Back": "RB",
  "Defensive Midfielder": "DMF",
  "Attacking Midfielder": "AMF",
  "Right Wing Forward": "RWF",
  "Centre Forward": "CF",
};

app.get('/generate', async (req, res) => {
  const baseUrl = 'https://pesdb.net/efootball/';
  const query = '?mode=authentic&pos=0,1,2,3,4,8,9,10,12&page=';

  const allPlayers = {};

  try {
    for (let page = 9; page <= 20; page++) {
      const { data: html } = await axios.get(`${baseUrl}${query}${page}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const $ = cheerio.load(html);

      $('table.players tr').each((_, row) => {
        const posCell = $(row).find('td').eq(0);
        const nameCell = $(row).find('td').eq(1);
        if (!posCell.length || !nameCell.length) return;

        const position = posMap[$(posCell).find('div').attr('title')];
        if (!position) return;

        const idMatch = nameCell.find('a').attr('href')?.match(/id=(\d+)/);
        const id = idMatch ? idMatch[1] : null;
        if (!id) return;

        const player = {
          name: nameCell.text().trim(),
          id,
          position,
          age: $(row).find('td').eq(6).text().trim(),
          rating: $(row).find('td').eq(7).text().trim()
        };

        if (!allPlayers[position]) allPlayers[position] = [];
        allPlayers[position].push(player);
      });
    }

    const finalTeam = {};
    for (const [pos, count] of Object.entries(positionsNeeded)) {
      const pool = allPlayers[pos];
      if (!pool || pool.length < count) {
        return res.status(500).json({ error: `Not enough players for position: ${pos}` });
      }

      const selected = [];
      const usedIndices = new Set();

      while (selected.length < count) {
        const randIdx = Math.floor(Math.random() * pool.length);
        if (!usedIndices.has(randIdx)) {
          selected.push(pool[randIdx]);
          usedIndices.add(randIdx);
        }
      }

      finalTeam[pos] = selected;
    }

    res.json({ team: finalTeam });
  } catch (err) {
    console.error('⚠️ Generate route failed:', err.message);
    res.status(500).json({ error: 'Failed to generate team' });
  }
});
app.get('/pull:count', async (req, res) => {
  const count = parseInt(req.params.count);
  if (isNaN(count) || count <= 0) {
    return res.status(400).json({ error: 'Invalid count number in URL' });
  }

  const baseUrl = 'https://pesdb.net/efootball/';
  const query = '?mode=authentic&pos=0,1,2,3,4,8,9,10,12&page=';
  const posMap = {
    "Goalkeeper": "GK",
    "Centre Back": "CB",
    "Left Back": "LB",
    "Right Back": "RB",
    "Defensive Midfielder": "DMF",
    "Attacking Midfielder": "AMF",
    "Right Wing Forward": "RWF",
    "Centre Forward": "CF",
  };

  const allPlayers = [];

  try {
    for (let page = 6; page <= 30; page++) {
      const { data: html } = await axios.get(`${baseUrl}${query}${page}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const $ = cheerio.load(html);

      $('table.players tr').each((_, row) => {
        const posCell = $(row).find('td').eq(0);
        const nameCell = $(row).find('td').eq(1);
        if (!posCell.length || !nameCell.length) return;

        const position = posMap[$(posCell).find('div').attr('title')];
        if (!position) return;

        const idMatch = nameCell.find('a').attr('href')?.match(/id=(\d+)/);
        const id = idMatch ? idMatch[1] : null;
        if (!id) return;

        const player = {
          name: nameCell.text().trim(),
          id,
          position,
          age: $(row).find('td').eq(6).text().trim(),
          rating: $(row).find('td').eq(7).text().trim()
        };

        allPlayers.push(player);
      });
    }

    if (allPlayers.length < count) {
      return res.status(500).json({ error: `Only found ${allPlayers.length} players, can't return ${count}` });
    }

    const selected = [];
    const usedIndices = new Set();

    while (selected.length < count) {
      const randIdx = Math.floor(Math.random() * allPlayers.length);
      if (!usedIndices.has(randIdx)) {
        selected.push(allPlayers[randIdx]);
        usedIndices.add(randIdx);
      }
    }

    res.json({ pulled: selected });
  } catch (err) {
    console.error('⚠️ Pull route failed:', err.message);
    res.status(500).json({ error: 'Failed to pull players' });
  }
});

app.listen(PORT, () => {
  console.log(`🟢 Server running at http://localhost:${PORT}`);
});
