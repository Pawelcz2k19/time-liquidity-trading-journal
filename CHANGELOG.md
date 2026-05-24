# Changelog — Time-Liquidity Trading Journal

Wszystkie istotne zmiany w tym projekcie są dokumentowane w tym pliku.
Kolejne wersje numerowane są jako `v1`, `v2`, `v3`... (proste numery, bez semver).

Każda wersja ma odpowiadający jej [GitHub Release](https://github.com/Pawelcz2k19/time-liquidity-trading-journal/releases) z linkiem do tagu.

Pełna dokumentacja użytkownika funkcji journala znajduje się w **[USER_GUIDE.md](./USER_GUIDE.md)**.

---

## [v7](https://github.com/Pawelcz2k19/time-liquidity-trading-journal/releases/tag/v7) — Solidne parsery OCR (XTB desktop/mobile, MT5, TopstepX)

**Co nowego:**

Przepisane parsery OCR pod realne dane ze zdjęć brokerów. Testy na 4 prawdziwych screenshotach (XTB desktop 4 trade'y, XTB mobile 2 trade'y, MT5 mobilny 3 trade'y, TopstepX 4 trade'y) — wszystkie 13 transakcji parsuje się poprawnie, z idealnymi cenami, ilościami, PnL i kierunkiem.

**Najważniejsze poprawki:**

1. **XTB desktop** — data odzyskiwana z głosowania na zmasakrowanych 8-cyfrowych ciągach (OCR mieszał `21.04.2026` w `ALDE` / `21042020`). PnL bez kropki (`5591`) automatycznie poprawiany na `55.91`. Znak PnL i kierunek (long/short) wyliczane z mnożnika CFD (`NAS100` = 20 USD / punkt / lot) zamiast polegać na zniekształconym "Buy/Sell".
2. **MT5 mobile** — `US100.cash` poprawnie mapowany na `NAS100` (norm. symbolu strippuje kropki).
3. **XTB mobile** — symbol dziedziczony z poprzedniego trade'a jeśli OCR wytnie nagłówek (np. `EDU +53.96 USD` zamiast `EG US100 CFD +53.96 USD`).
4. **TopstepX** — sumaryczne `PnL: +$1543.00` (Total Day) odfiltrowane, brane są tylko per-contract Day PnL.

**Jak działa:**

Proces importu jest niezmieniony (Image / Paste text / Ctrl+V), wszystkie zmiany są pod spodem. Wynik parsowania jest dokładniejszy nawet gdy OCR jest brudny.

---

## [v6](https://github.com/Pawelcz2k19/time-liquidity-trading-journal/releases/tag/v6) — Wklejanie tekstu + paste anywhere

**Co nowego:**

Dwa kolejne sposoby na import trade'ów, oba szybsze niż OCR ze zdjęcia.

1. **Paste text mode** — zakładka **Paste text** obok **Image / screenshot** w modalu importu. Wklejasz surowy tekst skopiowany z brokera (zaznacz tabelkę → Ctrl+C) i parser działa **bez OCR** — szybciej, dokładniej, bez ryzyka literacych błędów OCR.

2. **Global paste anywhere** — jesteś na stronie **Trades**, robisz Ctrl+V (lub Cmd+V) gdziekolwiek na stronie. Apka sama wykrywa zawartość schowka:
   - **Obrazek** → otwiera modal i odpala OCR
   - **Tekst** → otwiera modal w trybie tekstu i od razu parsuje
   - **Inputy/textarea** — omijane, normalny paste działa tam jak zwykle

**Jak używać:**

- **Z desktopu brokera**: na stronie z historią trade'ów zaznacz tabelę (Ctrl+A albo myszką), Ctrl+C → przejdź do journala, Trades → Ctrl+V → modal otwiera się z gotowymi danymi
- **Ze zdjęcia (telefon/PC)**: zrób screenshot, skopiuj do schowka, na stronie Trades Ctrl+V → OCR automatycznie odpala się
- **Ręczny tekst**: kliknij **Import / paste** → zakładka **Paste text** → wklej/wpisz → **Parse text**

**Zmiany techniczne:**
- `client/src/components/import-from-image.tsx`: nowe state `mode: "image" | "text"`, `handleText()` parsuje bez OCR
- Globalny `window.addEventListener("paste", ...)` w useEffect, omija inputy/textarea/contenteditable
- Modal title zmieniony na *"Import trades from your broker"*
- Przycisk z **Import from image** na **Import / paste**

**Dlaczego paste text bywa lepszy niż paste zdjęcie:**
- Brak błędów OCR (0 ↔ O, 1 ↔ I, 5 ↔ S)
- Brak ładowania Tesseract (3–10s oszczędności)
- Więcej brokery wspieranych — nawet jeśli nie ma sztywnego parsera, generic fallback działa lepiej na czystym tekście

---

## [v5](https://github.com/Pawelcz2k19/time-liquidity-trading-journal/releases/tag/v5) — Import trade'ów ze zdjęcia (OCR)

**Co nowego:**

Możesz teraz wrzucić screen z brokera (XTB desktop, XTB mobile, MetaTrader 5, TopstepX, Tradovate, NinjaTrader, IBKR) i apka **sama wyczyta trade'y** — bez ręcznego przepisywania, bez AI, bez kosztów.

**Jak to działa:**

- **Tesseract.js** robi OCR w przeglądarce (offline, lokalnie — żadne dane nie lecą nigdzie)
- **Broker detector** rozpoznaje którego brokera dotyczy zdjęcie po słowach kluczowych (`Zysk/strata` → XTB, `Total Day PnL` → TopstepX, `Bilancio` → MT5 itd.)
- **Parsery per broker** wyciągają trade'y z surowego tekstu
- **Preview** z edytowalną tabelą — wszystkie pola pokazane przed importem, żółtym podświetlone te które OCR pominął albo które trzeba uzupełnić

**Wspierane brokery:**

| Broker | Co wyciąga |
|---|---|
| XTB desktop | data, symbol, kierunek, ceny entry/exit, wolumen, P&L |
| XTB mobile | data, symbol, kierunek, wolumen, entry price, P&L |
| MetaTrader 5 (mobile) | data+godzina, symbol, kierunek, wolumen, entry/exit, P&L |
| TopstepX / Tradovate | symbol, P&L per kontrakt (entry/exit zwykle nie widoczne na screenie) |
| Generic fallback | dowolny inny broker — best-effort |

**Jak używać:**

1. Wejdź w **Trades** → kliknij **Import from image**
2. Przeciągnij screen z brokera (możesz wrzucić kilka naraz) — lub wklej z clipboardu **Ctrl+V**
3. Czekaj 3–10s aż Tesseract przeczyta zdjęcia (lokalnie)
4. W preview sprawdź i popraw co trzeba — zaznacz/odznacz checkboxami które trade'y zaimportować
5. Klik **Import N trades** — wszystko leci do bazy
6. Po imporcie otwórz każdy trade i ustaw stop price (potrzebny do liczenia R-multiple), tagi setupu, screenshot

**Co OCR potrafi a czego nie:**
- ✅ Ostre, kontrastowe screeny — wysoka skuteczność (>90%)
- ✅ Wiele zdjęć naraz, wiele brokerów wymieszanych
- ⚠ Ucięte tabele (np. brakuje kolumny exit) — wyciągnie co widać, resztę uzupełnisz ręcznie
- ❌ Stop price — brokerzy rzadko go pokazują w historii, musisz dodać sam

**Filozofia:**
Zero AI = zero kosztów = zero wysyłania danych nigdzie. Wszystko liczy się w twojej przeglądarce na twoim telefonie/komputerze. Preview zawsze pokazuje co wyciągnęło — nigdy nie zapisze nic bez twojego potwierdzenia.

---

## [v4](https://github.com/Pawelcz2k19/time-liquidity-trading-journal/releases/tag/v4) — Documentation: CHANGELOG + USER_GUIDE

**Co nowego:**
- Dodano `CHANGELOG.md` — historia wszystkich wersji w polskim
- Dodano `USER_GUIDE.md` — kompletny przewodnik użytkownika krok po kroku
- Konwencja: każdy commit pushowany do GitHuba dostaje kolejny numer (v5, v6...) i odpowiadający mu Release

---

## [v3](https://github.com/Pawelcz2k19/time-liquidity-trading-journal/releases/tag/v3) — Soft Risk Awareness Nudges

**Co nowego:**

Trzy miejsca w apce zostały rozszerzone o **miękkie ostrzeżenia ryzyka** — nigdy nie blokują logowania trade'a, tylko informują.

1. **Dashboard — kafelek "Today's Risk"** (zawsze widoczny)
   - Dzisiejsze R, P&L, liczba trade'ów, loss streak
   - Pasek postępu w kierunku dziennego limitu (neutralny → bursztynowy → czerwony)
   - Pod spodem konkretne powody, jeśli przekroczyłeś próg

2. **Trade form (tylko nowy trade) — dismissible banner**
   - Pojawia się gdy ryzyko osiągnęło poziom ostrzegawczy
   - X żeby zamknąć — możesz logować trade normalnie
   - Sugestywny język: *"You can absolutely log this trade — just a moment to check: is this your plan, or is this tilt? Walking away is also a trade."*

3. **Settings — sekcja "Risk Awareness Nudges"**
   - Toggle on/off (możesz całkowicie wyłączyć)
   - Daily loss limit w R (domyślnie -2R)
   - Max consecutive losses (domyślnie 3)

**Zmiany techniczne:**
- Nowe pola w `settings`: `dailyLossLimitR`, `maxConsecutiveLosses`, `riskNudgesEnabled`
- Defensive `ALTER TABLE` dla istniejących baz (twoje dane się zachowują)
- Nowy komponent `<RiskNudge>` w `client/src/components/risk-nudge.tsx`
- Helper `computeRiskStatus()` w `client/src/lib/stats.ts`

**Jak używać:**
1. Wejdź w **Settings** → przewiń do **Risk Awareness Nudges**
2. Włącz/wyłącz toggle, ustaw swoje progi (np. `-3R` jeśli grasz większym ryzykiem)
3. Zapisz — dashboard od razu pokaże kafelek dla dzisiejszego dnia
4. Gdy ryzyko zostanie przekroczone, nowy trade form pokaże baner — możesz go zamknąć i kontynuować lub odejść od ekranu

**Filozofia:**
Nigdy nie blokuje. Nawet jednego trade'a. Pokazuje tylko cyfry i daje moment pauzy. Język jest sugestywny, nie nakazowy — speed bump, nie ściana.

---

## [v2](https://github.com/Pawelcz2k19/time-liquidity-trading-journal/releases/tag/v2) — Security Hardening

**Co nowego:**

Pre-publish security review przed integracją z kursem. Same zmiany infrastrukturalne — UI bez zmian.

- **Nagłówki bezpieczeństwa**: `Content-Security-Policy: frame-ancestors`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`
- **Rate limiting**: 200 req/min na `/api/`, 5 req/min na `/api/import` i `/api/export`
- **Walidacja Zod** payloadu `/api/import` — wszystkie 4 schematy (trades, journals, playbooks, settings) wymuszone
- **Czystka zależności**: usunięto nieużywane `passport`, `passport-local`, `express-session`, `memorystore`, `supabase-js`, `connect-pg-simple`
- **Czyste buildy**: usunięcie plików `data.db*` przed pakowaniem (nie wyciekają z developmentu)

**Co to zmienia dla użytkownika:**
- Apka bezpieczniejsza przed clickjackiem i atakami DDoS
- Nic w UI nie zmienione — funkcjonalnie identyczna jak v1

---

## [v1](https://github.com/Pawelcz2k19/time-liquidity-trading-journal/releases/tag/v1) — Initial Release

**Co nowego:**

Pierwsza publiczna wersja Trading Journala — pełnoprawna apka do journalingu trade'ów dopasowana do strategii Time-Liquidity (NQ/MNQ, okno 9:30–10:15 ET).

**Funkcje:**
- **Dashboard** — 12 KPI, equity curve, 12-tygodniowy calendar heatmap, ostatnie trade'y, Course-Score
- **Trade Log** — sortowalna i filtrowalna tabela trade'ów
- **Add/Edit Trade** — auto-kalkulacja R-multiple, tag pickery (setup / mistake / emotion), upload screenshotów, sprawdzenia zgodności z regułami Modułu 12
- **Daily Journal** — pre-market plan + post-session review
- **Playbooks** — definicje setupów z regułami i checklistą + statystyki per-playbook
- **Reports** — P&L per symbol/setup/mistake/dzień tygodnia/godzina, rozkład R
- **Settings** — wielkość konta, RPT%, defaulty, export/import JSON

**Stack:**
- Backend: Express + SQLite (better-sqlite3) + Drizzle ORM
- Frontend: React + Vite + Tailwind + shadcn/ui
- Persistencja: SQLite (`data.db`) przeżywająca redeploy

**Jak używać:**
Otwórz [stronę journala](https://www.perplexity.ai/computer/a/time-liquidity-trading-journal-WGFSgOKxQjSwlCIZ12Mgxg). Dodaj swój pierwszy trade w sekcji **Trades** → **+ New Trade**. Wszystko zapisuje się w bazie serwerowej, dane przeżywają między sesjami.

---

## Konwencja wersjonowania

Każdy commit pushowany do GitHuba dostaje kolejny numer (v7, v8...) oraz odpowiadający mu **GitHub Release** z opisem zmian. Ten plik aktualizujemy razem z każdą nową wersją.
