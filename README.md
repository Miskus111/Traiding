# Trader Cost Hub

Moderní webová aplikace pro sledování nákladů na prop trading, faktur,
challenge fees, payoutů a čistého výsledku.

## Co první verze umí

- přihlášení přes e-mail pro oddělení dat více lokálních uživatelů,
- nahrání faktury jako soubor a ruční doplnění částky,
- základní předvyplnění dat z textových nebo CSV faktur,
- ruční přidávání payoutů,
- výpočet nákladů, payoutů, čistého výsledku a ROI v CZK,
- přehled podle měsíců a podle prop firmy,
- historie nákladů a payoutů,
- export dat do JSON.

## Důležitá poznámka k účtům

Aktuální verze je prototyp: data se ukládají v prohlížeči přes `localStorage`.
To je dobré pro rychlé ověření workflow a designu, ale není to ostré veřejné
multi-user řešení.

Pro produkční verzi bude potřeba doplnit:

- skutečné přihlášení,
- databázi pro uživatele, faktury a payouty,
- úložiště souborů pro faktury,
- OCR nebo parser pro automatické čtení PDF faktur.

## Spuštění

Je potřeba Node.js `22.x`.

```bash
npm install
npm run dev
```

Potom otevři lokální URL, kterou příkaz vypíše.

## Další otázky pro pokračování

1. Má být ostré přihlášení přes e-mail a heslo, Google, nebo „Sign in with ChatGPT“?
2. Jaké prop firmy používáš nejčastěji?
3. Chceš náklady a payouty počítat primárně v CZK, EUR, nebo USD?
