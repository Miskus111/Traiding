# Trader Cost Hub

Moderní multi-user webová aplikace pro sledování nákladů na prop trading,
faktur, challenge fees, payoutů a čistého výsledku.

## Funkce

- registrace a přihlášení uživatelů,
- hashovaná hesla a httpOnly session cookie,
- Postgres databáze pro účty, náklady a payouty,
- oddělení dat podle přihlášeného uživatele,
- přidávání faktur / challenge fees,
- přidávání payoutů,
- souhrn nákladů, payoutů, čistého výsledku a ROI,
- přehled podle měsíců a prop firem,
- export dat do JSON.

## Vercel nastavení

Projekt je připravený pro Vercel jako čistý Next.js projekt.

Ve Vercelu přidej Postgres databázi a nastav jednu z těchto env proměnných:

```txt
POSTGRES_URL=...
```

nebo:

```txt
DATABASE_URL=...
```

Doporučené je nastavit také:

```txt
SESSION_SECRET=dlouhy-nahodny-tajny-retezec
```

Tabulky se vytvoří automaticky při prvním API requestu.

## Lokální spuštění

Je potřeba Node.js `22.x`.

```bash
npm install
npm run dev
```

Pro lokální databázi nastav `.env.local`:

```txt
POSTGRES_URL=postgres://user:password@localhost:5432/trader_cost_hub
SESSION_SECRET=local-secret-change-me
```

## Poznámka k fakturám

Aktuální verze ukládá název nahrané faktury a metadata. Pro reálné ukládání PDF
souborů je další krok napojení na Vercel Blob nebo jiné souborové úložiště.
