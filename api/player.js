import axios from 'axios';
import cheerio from 'cheerio';

export default async function handler(req, res) {
  const id = req.query.id || '88033407929808'; // Default player ID
  const URL = `https://pesdb.net/efootball/?id=${id}&mode=max_level`;

  try {
    const { data: html } = await axios.get(URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const $ = cheerio.load(html);
    const stats = {};

    // Helper to extract trailing 2-3 digit numbers
    const parseNumber = (str) => {
      const match = str.match(/(\d{2,3})$/);
      return match ? parseInt(match[1], 10) : str;
    };

    // Player name
    stats['Player Name'] = $('h1').first().text().trim();

    // Stats from table
    $('table').find('tr').each((_, el) => {
      const key = $(el).find('th').text().trim().replace(/:$/, '');
      const val = $(el).find('td').text().trim();
      if (key && val) stats[key] = parseNumber(val);
    });

    // Card info
    const cardBox = $('td[colspan="2"] .flip-box-inner');
    if (cardBox.length) {
      const frontImg = cardBox.find('.flip-box-front img').attr('src');
      const backImg = cardBox.find('.flip-box-back img').attr('src');
      const cardType = cardBox.closest('td').text().trim().split('\n').pop().trim();

      stats['Card Front'] = frontImg || null;
      stats['Card Back'] = backImg || null;
      stats['Card Type'] = cardType || null;
    }

    res.status(200).json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Scraping failed', detail: err.message });
  }
}
