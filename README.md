# Simulator Dopplerova pomaka i RSSI-ja oko bazne stanice

Mala Three.js simulacija za seminar iz mobilnih komunikacija. Vozilo predstavlja prijamnik koji se giba oko bazne stanice. Cilj je pokazati tri slučaja: približavanje daje pozitivan Dopplerov pomak, udaljavanje negativan, a paralelno gibanje približno nulu.

## Pokretanje lokalno

```bash
npm install
npm run dev
```

Zatim otvori lokalni URL koji ispiše Vite, najčešće:

```text
http://127.0.0.1:5173/
```

## Upravljanje

- `W` / `ArrowUp`: ubrzaj
- `S` / `ArrowDown`: koči / vožnja unatrag
- `A` / `ArrowLeft`: skreni lijevo
- `D` / `ArrowRight`: skreni desno
- `R`: resetiraj vozilo

## Komunikacijski model

Proračunata razina primljenog signala koristi log-distance model putnog gubitka:

```text
RSSI(d) = RSSI_1m - 10 * n * log10(d)
```

Simulacija koristi `RSSI_1m = -30 dBm`, eksponent putnog gubitka `n = 2.7` i efektivnu udaljenost `d_eff = max(d, 1 m)`.

Dopplerov pomak koristi radijalnu brzinu:

```text
f_D = (v_r / c) * f_c
```

gdje je `c = 3e8 m/s`, `f_c` odabrana nosiva frekvencija, a `v_r` projekcija brzine vozila na smjer od vozila prema baznoj stanici. Pozitivna vrijednost znači približavanje baznoj stanici, negativna udaljavanje, a vrijednost blizu nule bočno ili kružno gibanje.

Demo gumbi postavljaju vozilo u tri korisna slučaja: prema baznoj stanici, od bazne stanice i približno paralelno (tj. u krug) oko bazne stanice.

Valni prstenovi mijenjaju boju prema izračunatom RSSI-ju: zeleno je jači prijam, žuto srednji, crveno slabiji. Panel "Izračun u ovom trenutku" prikazuje iste formule s trenutačnim vrijednostima iz simulacije.
