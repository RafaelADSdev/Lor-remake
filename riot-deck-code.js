/* Independent JS implementation of the public Riot DeckCodes format (versions 1–5).
   Specification: https://github.com/RiotGames/LoRDeckCodes */
(function (root) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
    regions = {
      0: "DE",
      1: "FR",
      2: "IO",
      3: "NX",
      4: "PZ",
      5: "SI",
      6: "BW",
      7: "SH",
      9: "MT",
      10: "BC",
      12: "RU",
    };
  const ids = Object.fromEntries(
    Object.entries(regions).map(([n, r]) => [r, Number(n)]),
  );
  const versions = {
    DE: 1,
    FR: 1,
    IO: 1,
    NX: 1,
    PZ: 1,
    SI: 1,
    BW: 2,
    MT: 2,
    SH: 3,
    BC: 4,
    RU: 5,
  };
  function decode(input) {
    const text = String(input)
      .replace(/\s/g, "")
      .toUpperCase()
      .replace(/=+$/, "");
    if (!text || text.length > 2048 || !/^[A-Z2-7]+$/.test(text))
      throw Error("Código LoR inválido.");
    let buffer = 0,
      bits = 0;
    const bytes = [];
    for (const ch of text) {
      buffer = buffer * 32 + alphabet.indexOf(ch);
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        bytes.push(Math.floor(buffer / 2 ** bits) & 255);
        buffer %= 2 ** bits;
      }
    }
    if (
      buffer !== 0 ||
      bytes[0] >> 4 !== 1 ||
      (bytes[0] & 15) < 1 ||
      (bytes[0] & 15) > 5
    )
      throw Error("Formato ou versão de código não suportado.");
    let index = 1;
    const result = [];
    function number() {
      let value = 0,
        factor = 1;
      for (let n = 0; n < 4; n++) {
        if (index >= bytes.length) throw Error("Código incompleto.");
        const b = bytes[index++];
        value += (b & 127) * factor;
        if (b < 128) return value;
        factor *= 128;
      }
      throw Error("Inteiro inválido.");
    }
    function add(count, set, region, id) {
      if (
        count < 1 ||
        count > 40 ||
        set < 1 ||
        set > 99 ||
        !regions[region] ||
        id > 999 ||
        result.length + count > 200
      )
        throw Error("Cartas inválidas no código.");
      const code =
        String(set).padStart(2, "0") +
        regions[region] +
        String(id).padStart(3, "0");
      for (let n = 0; n < count; n++) result.push(code);
    }
    for (let count = 3; count >= 1; count--) {
      const groups = number();
      if (groups > 200) throw Error("Grupos inválidos.");
      for (let g = 0; g < groups; g++) {
        const size = number(),
          set = number(),
          region = number();
        if (size > 200) throw Error("Grupo muito grande.");
        for (let n = 0; n < size; n++) add(count, set, region, number());
      }
    }
    while (index < bytes.length) {
      const count = number(),
        set = number(),
        region = number(),
        id = number();
      add(count, set, region, id);
    }
    return result;
  }
  function encode(cards) {
    if (!Array.isArray(cards) || !cards.length || cards.length > 200)
      throw Error("Lista de cartas inválida.");
    const counts = {};
    let version = 1;
    for (const code of cards) {
      if (
        !/^\d{2}[A-Z]{2}\d{3}$/.test(code) ||
        !ids.hasOwnProperty(code.slice(2, 4)) ||
        Number(code.slice(0, 2)) < 1
      )
        throw Error("Código de carta inválido.");
      counts[code] = (counts[code] || 0) + 1;
      version = Math.max(version, versions[code.slice(2, 4)]);
    }
    const bytes = [16 | version];
    function write(n) {
      do {
        const byte = n % 128;
        n = Math.floor(n / 128);
        bytes.push(byte + (n ? 128 : 0));
      } while (n);
    }
    function parts(code) {
      return [
        Number(code.slice(0, 2)),
        ids[code.slice(2, 4)],
        Number(code.slice(4)),
      ];
    }
    for (let count = 3; count >= 1; count--) {
      const groups = {};
      for (const code of Object.keys(counts).sort())
        if (counts[code] === count)
          (groups[code.slice(0, 4)] ||= []).push(code);
      const ordered = Object.values(groups).sort(
        (a, b) => a.length - b.length || a[0].localeCompare(b[0]),
      );
      write(ordered.length);
      for (const group of ordered) {
        const [set, region] = parts(group[0]);
        write(group.length);
        write(set);
        write(region);
        for (const code of group) write(parts(code)[2]);
      }
    }
    for (const code of Object.keys(counts).sort())
      if (counts[code] > 3) {
        if (counts[code] > 40) throw Error("Cópias demais.");
        write(counts[code]);
        for (const n of parts(code)) write(n);
      }
    let value = 0,
      bits = 0,
      result = "";
    for (const byte of bytes) {
      value = value * 256 + byte;
      bits += 8;
      while (bits >= 5) {
        bits -= 5;
        result += alphabet[Math.floor(value / 2 ** bits) & 31];
        value %= 2 ** bits;
      }
    }
    if (bits) result += alphabet[(value * 2 ** (5 - bits)) & 31];
    return result;
  }
  const api = { decode, encode };
  if (typeof module !== "undefined") module.exports = api;
  else root.RiotDeckCode = api;
})(typeof window === "undefined" ? globalThis : window);
