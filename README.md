# Citadela posledního světla

Filmová browserová plošinovka inspirovaná klasikou žánru. Hra používá vlastní svět, postavy i grafické zpracování a běží bez frameworků či externích runtime závislostí.

## Spuštění

Je potřeba Node.js 20 nebo novější.

```bash
npm run dev
```

Hra se otevře na `http://localhost:5173`.

## Ovládání

- `A` / `D` nebo šipky vlevo / vpravo: pohyb
- `W`, šipka nahoru nebo mezerník: skok a šplh
- `S` nebo šipka dolů: skrčení a seskok z římsy
- `Shift`: opatrná chůze, která se zastaví před hranou
- `F` nebo `J`: útok
- `R` nebo `K`: kryt a časované odražení
- `E` nebo `Enter`: páka, brána a další interakce
- `P` nebo `Escape`: pauza

Podporovaný je také gamepad a na dotykových zařízeních se zobrazí ovládací prvky přímo ve hře.

## Kontroly a build

```bash
npm test
npm run check
npm run build
npm run preview
```

Produkční soubory vzniknou v adresáři `dist/`. Build je prosté kopírování statických souborů, takže hra nepotřebuje serverovou část.

## Nasazení na Cloudflare Pages

Po propojení GitHub repozitáře vytvořte v Cloudflare Pages nový projekt a nastavte:

- Framework preset: `None`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: ponechat prázdný

Cloudflare po každém pushi do produkční větve automaticky spustí build a zveřejní novou verzi. Soubor `public/_headers` přidá základní bezpečnostní hlavičky.

## Struktura

- `index.html` a `styles.css` – vstupní stránka a vzhled
- `src/` – herní logika a data úrovní
- `public/` – manifest, ikona a Cloudflare hlavičky
- `tests/` – automatické testy herního jádra
- `scripts/` – lokální server, validace a build bez externích závislostí

## Licence a původnost

Projekt je samostatnou poctou filmovým plošinovkám. Nepoužívá původní grafiku, hudbu, zdrojový kód ani levely jiné hry.
