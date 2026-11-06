# Finnish — "11,000 searches for Finnish music" (AI bots swarm a university library)
Date: 2026-11-06 · category: AI/internet (bots) · slug: finnish

## Facts (sources)
- CBC News, 2026-11-05 "University libraries are being swarmed by AI bots, putting public access at risk": bot traffic
  has knocked whole collections offline; one institution logged 11,000+ bot searches on Finnish music in a single day;
  it has got worse since late 2024; CAPTCHAs/logins considered but they block people too.
  https://www.cbc.ca/news/world/university-libraries-ai-data-scraping-bots-9.7408287
  (also summarised by infoDOCKET/Library Journal 2026-11-05 and News Minimalist 2026-11-05)
- UNC Chapel Hill University Libraries, "Library IT vs. the AI bots" (primary source of the Finnish figure):
  Dec 2 (finals week) catalogue kept shutting people out: "This website is under heavy load (queue full)".
  Normal peak ~100 simultaneous searches; logs showed 500+. November: ~15 searches with "Finnish" + "music";
  Dec 4 alone: 11,329, from thousands of IP addresses. Humans use up to ~6 facets; bots used 15, 20, 25.
  Every query unique. Crawlers pulled the same records again through different paths. Library had already banned
  4 million+ IPs; blocking two complex queries in a row worked ~1 week; next wave ~2 million addresses banned in days;
  by mid-January an AI-based firewall blocked the bots and let people through. Believed to be LLM training scrapers.
  https://library.unc.edu/news/library-it-vs-the-ai-bots/
- Library Journal: same UNC figures; OAPEN offline almost two days; Project Gutenberg outages.
  https://www.libraryjournal.com/story/ai-bots-swarm-library-cultural-heritage-sites-causing-slowdowns-and-crashes

## Script (auto-approved)
1 HOOK      In one single day, a university library got eleven thousand searches... for Finnish music.
2           The month before? Fifteen.
3 SETTING   North Carolina. Finals week. Students cramming. The library catalogue, humming along.
4 BEAT 1    Normally, about a hundred people search at once.
5 BEAT 2    Then five hundred.
6 BEAT 3    Every search was different, and weirdly picky. A human ticks maybe six filters. These ticked twenty-five.
7 SNAP      Then the screen just said: queue full. Everybody out.
8 DEADPAN   Luckily, Finland had not suddenly become famous. / Unluckily, the visitors were not people.
9 EXPLAIN   They were bots, scraping everything to feed A.I. models. Picture a guest at a buffet who doesn't eat.
            He fills a truck... then sneaks back in line through a different door. Again. And again.
10 CONSEQ   The library banned millions of addresses. The bots just came back from new ones.
            So now an A.I. guards the door, letting people in and keeping bots out.
11 TWIST    And this week, libraries everywhere say it's getting worse.
            Somewhere, a computer now knows more about Finnish music than Finland... and it has never heard a single note.
