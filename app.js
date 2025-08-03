const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 7860;

app.get('/api/player', async (req, res) => {
  const playerId = req.query.playerid;

  if (!playerId) {
    return res.status(400).json({ error: 'Missing playerid in query' });
  }

  const URL = `https://pesdb.net/efootball/?id=${playerId}&mode=max_level`;

  try {
    const { data: html } = await axios.get(URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const $ = cheerio.load(html);
    const stats = {};

    const parseNumber = (str) => {
      const match = str.match(/(\d{2,3})$/);
      return match ? parseInt(match[1], 10) : str;
    };

    // Player name
    stats['Player Name'] = $('h1').first().text().trim();

    // Table stats
    $('table tr').each((_, el) => {
      const key = $(el).find('th').text().trim().replace(/:$/, '');
      const val = $(el).find('td').text().trim();
      if (key && val) {
        stats[key] = parseNumber(val);
      }
    });

    // Card details
    const cardBox = $('td[colspan="2"] .flip-box-inner');
    if (cardBox.length) {
      stats['Card Front'] = cardBox.find('.flip-box-front img').attr('src') || null;
      stats['Card Back'] = cardBox.find('.flip-box-back img').attr('src') || null;
      const cardType = cardBox.closest('td').text().trim().split('\n').pop().trim();
      stats['Card Type'] = cardType || null;
    }

    res.json(stats);
  } catch (err) {
    console.error('Scrape error:', err.message);
    res.status(500).json({ error: 'Failed to fetch or parse player data.' });
  }
});

app.listen(PORT, () => {
  console.log(`🟢 Server running at http://localhost:${PORT}`);
});
