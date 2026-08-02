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
- smart import textu z faktury nebo payout e-mailu,
- rozpoznání prop firmy, programu/účtu, částky, měny, data a typu záznamu,
- souhrn nákladů, payoutů, čistého výsledku a ROI,
- přehled podle konkrétního účtu / programu,
- přehled podle měsíců a prop firem,
- export dat do JSON.

## Vercel nastavení

Projekt je připravený pro Vercel jako čistý Next.js projekt.

Ve Vercelu přidej Postgres databázi. Aplikaci stačí jedna databázová proměnná.
Podporované jsou tyto názvy, takže fungují i automatické proměnné z Neon integrace:

```txt
POSTGRES_URL=...
DATABASE_URL=...
DATABASE_URL_UNPOOLED=...
POSTGRES_PRISMA_URL=...
POSTGRES_URL_NON_POOLING=...
```

Nastav také:

```txt
SESSION_SECRET=dlouhy-nahodny-tajny-retezec
```

Tabulky se vytvoří automaticky při prvním API requestu.

Pokud se po deployi zobrazí hláška, že databáze chybí, zkontroluj ve Vercelu
`Project Settings → Environment Variables`, že je aspoň jedna z databázových
proměnných dostupná pro `Production`.

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
