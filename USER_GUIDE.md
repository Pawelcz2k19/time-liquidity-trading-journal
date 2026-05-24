# User Guide — Time-Liquidity Trading Journal

Pełny przewodnik po wszystkich funkcjach Trading Journala. Pisany krok po kroku — możesz czytać od początku do końca lub skoczyć do konkretnej sekcji.

**Live app:** [Time-Liquidity Trading Journal](https://www.perplexity.ai/computer/a/time-liquidity-trading-journal-WGFSgOKxQjSwlCIZ12Mgxg)

---

## Spis treści

1. [Pierwsze kroki](#pierwsze-kroki)
2. [Dashboard](#dashboard)
3. [Trade Log](#trade-log)
4. [Add / Edit Trade](#add--edit-trade)
5. [Import ze zdjęcia (OCR)](#import-ze-zdjęcia-ocr)
6. [Daily Journal](#daily-journal)
7. [Playbooks](#playbooks)
8. [Reports](#reports)
9. [Settings](#settings)
10. [Risk Awareness Nudges](#risk-awareness-nudges)
11. [Export / Import danych](#export--import-danych)
12. [FAQ](#faq)

---

## Pierwsze kroki

Apka działa od razu po otwarciu — nie ma logowania, nie ma kont, nie ma chmury. Wszystkie dane lądują w lokalnej bazie SQLite na serwerze i przeżywają redeploye.

**Zalecana kolejność na start:**

1. Wejdź w **Settings** → ustaw wielkość konta (`Account Size`) i ryzyko na trade (`Risk Per Trade %`). To dwa kluczowe pola — od nich liczy się R-multiple i wszystkie statystyki.
2. Wejdź w **Playbooks** → dodaj swoje 1–2 ulubione setupy (np. *Time-Liquidity Long*, *Time-Liquidity Short*). Bez tego trade'y nie będą mogły być przypisane do strategii.
3. Wejdź w **Trades** → **+ New Trade** → zaloguj pierwszy trade.
4. Dashboard od razu pokaże statystyki.

---

## Dashboard

Strona główna apki. Pokazuje stan twojego tradingu w jednym rzucie oka.

**Co tu zobaczysz:**

- **12 kafelków KPI** — łączne P&L, win rate, expectancy, średnie R, profit factor, max drawdown, streak, średni czas trzymania, ilość trade'ów, R-sum, najlepszy/najgorszy trade
- **Equity curve** — wykres skumulowanego P&L w czasie
- **12-tygodniowy calendar heatmap** — które dni miałeś zielone, które czerwone
- **Recent Trades** — 5 ostatnich trade'ów z linkiem do edycji
- **Course-Score** — ocena 0–100 jak bardzo trzymasz się reguł z kursu (Module 12)
- **Today's Risk** (tile) — jeśli włączone w Settings, kafelek z dzisiejszym R, P&L, loss streak i paskiem postępu w kierunku dziennego limitu

**Wskazówka:** Course-Score liczy m.in. czy wszystkie trade'y były w oknie 9:30–10:15 ET, czy miały 4/4 confirmation, czy ryzyko nie przekraczało założonego %. Im wyżej tym lepiej.

---

## Trade Log

Lista wszystkich twoich trade'ów. Sortowalna, filtrowalna, edytowalna.

**Co możesz robić:**

- **Sortować** po dowolnej kolumnie (data, symbol, R, P&L, setup)
- **Filtrować** po symbolu, setupie, dacie, wyniku (win/loss), tagach
- **Klikać w trade** żeby otworzyć formularz edycji
- **Bulk delete** — zaznacz kilka trade'ów i usuń jednym kliknięciem
- **+ New Trade** w prawym górnym rogu → przechodzi do formularza dodawania

**Kolumny w tabeli:**

| Kolumna | Znaczenie |
|---|---|
| Date | Data otwarcia |
| Symbol | NQ, MNQ, ES, itd. |
| Side | Long / Short |
| Entry | Cena wejścia |
| Exit | Cena wyjścia |
| R | R-multiple (zysk/ryzyko w wielokrotności początkowego stop-lossu) |
| P&L | Dollar P&L |
| Setup | Z którego playbooka |
| Tags | Mistakes / emotions tagi |

---

## Add / Edit Trade

Najważniejszy formularz w apce. Tu logujesz każdy trade.

**Pola obowiązkowe:**

- **Date & Time** — data i godzina wejścia (domyślnie *teraz*)
- **Symbol** — np. NQ, MNQ
- **Side** — Long / Short
- **Entry Price**
- **Stop Loss** — kluczowe, bez tego nie policzy się R
- **Exit Price**
- **Quantity** — liczba kontraktów

**Pola opcjonalne (ale warte wypełniania):**

- **Setup / Playbook** — z którego playbooka był ten trade (dropdown)
- **Setup Tags** — np. "9:30 sweep", "liquidity grab", "FVG retest"
- **Mistake Tags** — np. "chased entry", "moved stop", "revenge trade" — bądź brutalnie szczery, bo to napędza Reports
- **Emotion Tags** — np. "calm", "FOMO", "frustrated", "confident"
- **Notes** — wolny tekst, co poszło dobrze/źle
- **Screenshot upload** — wrzucasz zdjęcie wykresu, zapisuje się lokalnie
- **Rule Compliance** — checkboxy z regułami Module 12 (czy trade był w oknie 9:30–10:15? czy miał 4/4 confirmation? itp.) — wpływają na Course-Score

**Auto-kalkulacja R:**

Po wpisaniu entry, stop i exit apka sama liczy R-multiple. Np. entry 20000, stop 19980 (ryzyko 20 pkt), exit 20060 (zysk 60 pkt) = **+3R**.

**Jak używać efektywnie:**

1. Po każdym trade'ie od razu otwórz **+ New Trade** — nie czekaj do końca dnia
2. Wpisz wszystko póki świeże, łącznie z emocjami
3. Wrzuć screenshot z TradingView / NinjaTrader — później przy review masz pełen kontekst
4. Bądź szczery z mistake/emotion tagami — to jedyna droga żeby wyłapać wzorce w Reports

---

## Import ze zdjęcia (OCR)

Zamiast przepisywać trade'y ręcznie, możesz wrzucić screen z brokera — albo wkleić tekst skopiowany z brokera — i apka wyciągnie dane sama.

### Cztery sposoby importu

1. **Drag & drop zdjęcia** — najprostsze, działa na desktopie
2. **Kliknięcie** — otwiera dialog wyboru plików
3. **Paste anywhere** — **Ctrl+V (Cmd+V)** w dowolnym miejscu strony Trades:
   - Zawartość schowka to obrazek → automatycznie otwiera się modal z OCR
   - Zawartość schowka to tekst → modal otwiera się w trybie **Paste text** i od razu parsuje
   - W inputach/textarea paste działa normalnie — nie przejmuje
4. **Paste text mode** — zakładka **Paste text** w modalu importu, wklej/wpisz ręcznie tekst, klik **Parse text**. **Szybciej i dokładniej niż OCR**, bo bez ryzyka błędów typu 0↔O.

### Jak zacząć

1. Wejdź w **Trades**
2. Kliknij **Import / paste** (obok New trade) — lub po prostu **Ctrl+V** w dowolnym miejscu
3. Możesz wrzucić **kilka zdjęć naraz** — z różnych brokerów nawet

### Co dzieje się dalej

1. **OCR (3–10 sekund)** — Tesseract.js czyta tekst ze zdjęcia *lokalnie w przeglądarce*. Nic nie leci na żaden serwer, żadne AI, żadne koszty.
2. **Detekcja brokera** — apka rozpoznaje czy to XTB, MT5, TopstepX itd. po słowach kluczowych
3. **Preview** — pojawia się tabela z wyciągniętymi trade'ami, edytowalna, z podświetleniem niepewnych pól

### Kiedy użyć ktorego trybu

| Sytuacja | Najlepszy sposób |
|---|---|
| Broker w przeglądarce, możesz zaznaczyć tekst | **Paste text** (Ctrl+C w brokerze → Ctrl+V w journalu) |
| Aplikacja desktopowa brokera (XStation, MT5) | Screenshot → Ctrl+V |
| Telefon | Screenshot → drag & drop pliku |
| Wiele trade'ów z różnych brokerów | Drag & drop kilku obrazków naraz |

### Wspierani brokerzy

| Broker | Skuteczność | Co wyciąga |
|---|---|---|
| XTB desktop / web | wysoka | data, symbol, kierunek, entry/exit, wolumen, P&L |
| XTB mobile ("Moje Transakcje") | wysoka | data, symbol, kierunek, wolumen, entry, P&L |
| MetaTrader 5 mobile (PL/IT/EN) | wysoka | data+godzina, symbol, kierunek, wolumen, entry/exit, P&L |
| TopstepX / Tradovate | średnia | symbol, P&L (entry/exit zwykle nie widać) |
| NinjaTrader, IBKR | best-effort | co da się wyczytać |
| Inne brokery | generic fallback | symbol, kierunek, P&L — reszta ręcznie |

### Preview — edycja przed importem

W preview każda kolumna jest edytowalna:

- **Checkbox** po lewej — odznacz żeby pominąć dany wiersz
- **Żółte tło pola** — oznacza że OCR nie znalazł albo nie był pewny. Wpisz/popraw.
- **Conf. badge** (zielony/bursztynowy/czerwony) — ogólna pewność dla danego trade'a
- **🗑 koszyk** — usuń trade z importu
- **Show raw OCR text** — zobacz surowy tekst który odczytał Tesseract (debug)

### Co wypełniać, co zostawić

Apka wpisuje sensowne defaulty dla brakujących pól:
- **Brak daty** → dzisiaj
- **Brak godziny** → 09:30
- **Brak symbolu** → NAS100
- **Brak stop price** → 0.5% od entry (placeholder — popraw w trade detail!)
- **Brak entry/exit** → 0
- **pointValue** → 1 (dla CFD; popraw dla futures — NQ=20, MNQ=2, ES=50, MES=5)

### Po imporcie

Każdy zaimportowany trade dostaje notatkę `Imported from <broker>`. Żeby uzupełnić:

1. **Wejdź w trade w Trade Log** (klik ołówek)
2. Ustaw **stop price** — *kluczowe*, bez tego R-multiple będzie złe
3. Ustaw **pointValue** jeśli to futures (NQ/MNQ/ES/MES)
4. Dodaj **setup tag** (z playbooka), **mistake tags**, **emotion tags**
5. Wrzuć screenshot z TradingView

Dopiero po tym statystyki w Reports będą prawdziwe.

### Tips

- **Najlepsze zdjęcia OCR:** ostre, duży zoom, tylko widok historii bez paska narzędzi/pulpitu
- **Telefon:** zrób screen w wysokiej rozdzielczości, nie kompresuj
- **Wiele brokerów jednocześnie:** wrzucasz 3 screeny — z XTB, z MT5, z TopstepX — każdy jest przetwarzany osobno z własnym parserem
- **Złe odczyty?** Klik **Show raw OCR text** żeby zobaczyć co zobaczył Tesseract — pomoże zdiagnozować

### Ograniczenia

- **Stop price nigdy nie jest na screenie historii** — zawsze musisz dodać ręcznie
- **R-multiple liczone po dodaniu stopu** — zanim dodasz stop, R = 0
- **Ucięte tabele** (np. TopstepX z obciętą kolumną Qty) — wyciągnie tylko widoczne pola
- **Nieostre/za ciemne screeny** — OCR może pomylić 0/O, 1/I, 5/S itp.; preview pozwala poprawić

---

## Daily Journal

Pre-market plan + post-session review w jednym miejscu. Jeden wpis na dzień.

**Sekcje:**

- **Pre-market Plan** (wypełniaj przed sesją)
  - Bias na dziś (long/short/neutral)
  - Kluczowe poziomy (sweepy z nocy, HOD/LOD z poprzedniego dnia, FVG)
  - Plan: w jakich warunkach wchodzę, w jakich odpuszczam
  - News / catalysts (CPI, NFP, FOMC?)

- **Post-session Review** (wypełniaj po zamknięciu okna)
  - Co poszło zgodnie z planem
  - Co poszło niezgodnie z planem
  - Emocjonalny stan podczas sesji
  - Lekcja na jutro

**Jak używać:**

Otwórz **Journal** w sidebarze → wybierz dzisiejszą datę → wypełnij pre-market o 8:00, post-session o 10:30. To 2× po 3 minuty dziennie i jest jedna z najmocniejszych dźwigni w tradingu.

---

## Playbooks

Definicje twoich setupów. Każdy playbook = jedna strategia, którą tradeujesz.

**Co zawiera playbook:**

- **Name** — np. "Time-Liquidity Long"
- **Description** — co to za setup w 2–3 zdaniach
- **Rules / Checklist** — lista warunków które muszą być spełnione żeby wziąć trade
- **Time window** — np. 9:30–10:15 ET
- **R target** — typowy target (np. 2R)
- **Stats** — auto-liczone: ile trade'ów, win rate, expectancy, R-sum specyficzny dla tego playbooka

**Jak używać:**

1. Dodaj playbook *przed* tradeowaniem (nie po fakcie)
2. Przy każdym trade'ie w **Add Trade** wybierz odpowiedni playbook z dropdownu
3. Po 20–30 trade'ach na danym playbooku zobaczysz w Reports czy to działa
4. Playbook ze słabymi statystykami → usuwasz go z rotacji albo poprawiasz reguły

**Wskazówka:** Zacznij od max 2–3 playbooków. Pięć setupów jednocześnie = za mało danych na żaden.

---

## Reports

Tu mieszka prawda o twoim tradingu. Statystyki w 6 wymiarach.

**Dostępne raporty:**

1. **P&L per symbol** — które instrumenty zarabiają, które tracą
2. **P&L per setup** — który playbook jest twoją gotówkową krową, który topi pieniądze
3. **P&L per mistake tag** — *to jest złoto.* Pokazuje ile pieniędzy tracisz na "chasing entry", "moving stop", "revenge trade". Najtwardszy feedback w apce.
4. **P&L per day of week** — może w piątki tradeujesz najgorzej? Tu się dowiesz
5. **P&L per hour** — godzina po godzinie, sprawdzasz czy 9:30–10:15 to faktycznie twoje okno
6. **R-distribution histogram** — rozkład wszystkich R, widzisz czy masz fat tails po pozytywnej stronie

**Jak używać:**

Wejdź raz w tygodniu (np. niedziela). Przejrzyj wszystkie 6 raportów. Zapisz w **Daily Journal** jeden wniosek na następny tydzień (np. *"Nie tradeuje w piątki — w 2 z 3 piątków byłem na minusie"*).

---

## Settings

Konfiguracja apki. Tu ustawiasz wszystko co wpływa na obliczenia.

**Sekcje:**

### Account & Risk
- **Account Size** — wielkość konta w dolarach
- **Risk Per Trade %** — typowo 0.5–1%
- **Currency** — domyślnie USD

### Defaults
- **Default Symbol** — np. NQ
- **Default Quantity** — np. 1 kontrakt
- **Default Playbook** — który playbook ma być wstępnie zaznaczony w nowym trade

### Risk Awareness Nudges (v3)
Patrz osobny rozdział poniżej.

### Data
- **Export JSON** — pobiera wszystkie twoje dane (trades, journals, playbooks, settings) jako jeden plik JSON
- **Import JSON** — wczytuje plik backup'u

**Wskazówka:** Eksportuj co tydzień. To twoja jedyna kopia zapasowa.

---

## Risk Awareness Nudges

**Filozofia:** Apka nigdy nie blokuje twojego trade'a. Pokazuje tylko cyfry i daje moment pauzy. Ty decydujesz.

### Jak włączyć i skonfigurować

1. **Settings** → przewiń do **Risk Awareness Nudges**
2. **Enable nudges** — toggle on/off
3. **Daily loss limit (in R)** — np. `-2` oznacza że po stracie 2R apka pokaże alert
4. **Max consecutive losses** — np. `3` oznacza że po 3 stratach z rzędu pojawi się ostrzeżenie
5. Kliknij **Save**

### Gdzie się pojawia

**1. Dashboard — kafelek "Today's Risk"** (zawsze widoczny gdy włączone)

Pokazuje:
- Dzisiejsze R (suma R z dzisiejszych trade'ów)
- Dzisiejszy P&L w dolarach
- Liczbę trade'ów dzisiaj
- Loss streak (ile strat z rzędu)
- Pasek postępu w kierunku dziennego limitu
  - **Zielony / neutralny** → wszystko ok
  - **Bursztynowy (caution)** → blisko limitu
  - **Czerwony (alert)** → przekroczyłeś próg

Pod paskiem widać konkretne powody alertu, np. *"3 losing trades in a row"* albo *"Daily R: -2.3R (limit -2R)"*.

**2. Trade form — dismissible banner** (tylko gdy dodajesz nowy trade)

Jeśli ryzyko jest na poziomie alertu, na górze formularza pojawia się baner:

> ⚠ *You can absolutely log this trade — just a moment to check: is this your plan, or is this tilt? Walking away is also a trade.*

- **X** w prawym górnym rogu zamyka baner — formularz działa normalnie
- Baner **nie blokuje** zapisania trade'a
- Nie pojawia się przy edycji istniejącego trade'a

### Jak używać efektywnie

- **Próg `-2R`** to dobry start dla większości. Jeśli tradeujesz większym ryzykiem, ustaw `-3R` albo `-4R`.
- **Loss streak `3`** to klasyk tilt-prevention. Po 3 stratach z rzędu mózg zaczyna pracować w trybie "odzyskać" — najlepszy moment na pauzę.
- **Wyłącz całkiem** jeśli ci to przeszkadza — toggle off w Settings i nudges znikają. Bez konsekwencji.

### Co to NIE robi

- Nie blokuje trade'a
- Nie zapisuje twoich decyzji do dyscyplinowania
- Nie pokazuje powiadomień push
- Nie wysyła nigdzie danych — wszystko liczone lokalnie z twoich trade'ów dnia

---

## Export / Import danych

Twoje dane = twoja własność. Pełny backup w 2 klikach.

### Export

1. **Settings** → **Data** → **Export JSON**
2. Pobiera się plik `trading-journal-export-YYYY-MM-DD.json`
3. Zawiera: wszystkie trade'y, journals, playbooks, settings

### Import

1. **Settings** → **Data** → **Import JSON**
2. Wybierz wcześniej wyeksportowany plik
3. Apka waliduje strukturę (Zod schemas) i wczytuje dane

**UWAGA:** Import nadpisuje istniejące dane. Zrób export *przed* importem żeby mieć kopię obecnego stanu.

---

## FAQ

**Gdzie są zapisane moje dane?**

W bazie SQLite na serwerze (`data.db`). Przeżywa redeploye apki. Nie jest publicznie dostępna — tylko apka ma do niej dostęp.

**Czy moje dane są szyfrowane?**

Nie. To prywatna aplikacja bez autentykacji. Jeśli chcesz dodatkowej warstwy bezpieczeństwa — eksportuj regularnie i trzymaj backup zaszyfrowany lokalnie.

**Mogę używać apki na telefonie?**

Tak — jest responsywna. Ale formularz trade'a jest dużo wygodniejszy na desktopie.

**Co robić jak coś się zepsuje?**

Eksport JSON → zgłoś bug → przy następnym deployu zaimportuj plik z powrotem.

**Czy R liczy się dla longów i shortów identycznie?**

Tak. R = (|exit - entry|) / (|entry - stop|), znak ujemny jeśli stratny niezależnie od strony.

**Czy mogę dodawać trade'y wstecz?**

Tak — w **+ New Trade** zmień datę na dowolną przeszłą. Apka dolicza wszystko do statystyk.

**Co z partial fills / scaling out?**

Obecnie jeden trade = jedna pozycja. Jeśli skalujesz, loguj jako kilka osobnych trade'ów albo policz średnią entry/exit.

---

## Dodatkowe materiały

- [CHANGELOG.md](./CHANGELOG.md) — historia wersji
- [Kurs Time-Liquidity Trading](https://www.perplexity.ai/computer/a/time-liquidity-trading-course-U6A4AC4JS0W_1AtteJamiQ) — materiał edukacyjny, na którym oparty jest journal
- [GitHub Releases](https://github.com/Pawelcz2k19/time-liquidity-trading-journal/releases) — wszystkie wersje z notatkami

---

**Pytania albo bugi?** Otwórz issue na [GitHubie](https://github.com/Pawelcz2k19/time-liquidity-trading-journal/issues).
