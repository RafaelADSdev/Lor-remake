"""Ready-to-play decks composed only of implemented collectible cards."""
RECIPES = [
    ('braum_poros', 'Braum · Poros e Proteção', '01FR009 01FR053 01FR003 01FR011 01FR022 01FR035 01FR049 01FR050 01FR016 01FR004 01FR030 01FR046 03FR025', '01FR057'),
    ('anivia_rebirth', 'Anivia · Gelo e Renascimento', '01FR024 01FR022 01FR003 01FR011 01FR050 01FR047 01SI020 01SI043 01SI032 01FR012 01SI001 01FR020 01SI040', '01SI003'),
    ('tryndamere_ramp', 'Tryndamere · Mana e Fúria', '01FR039 01FR022 01FR003 01FR047 01FR050 01FR007 01FR041 01FR026 01FR012 01FR020 01FR042 01FR005 06FR036', '01FR023'),
    ('braum_scars', 'Braum · Cicatrizes do Freljord', '01FR009 01FR035 01FR032 01FR045 01FR013 01FR021 01FR054 05FR005 02FR001 01FR004 01FR010 06FR035 01FR046', '01FR057'),
    ('garen_challengers', 'Garen · Desafiadores de Demacia', '01DE012 01DE029 01DE011 01DE055 01DE043 01DE003 01DE015 01DE051 01DE026 01DE037 01DE032 01DE018 04DE002', '01DE002'),
    ('dragons_fury', 'Dragões · Fúria e Gemas', '03DE006 04DE016 08DE025 03DE013 02DE004 01DE029 01DE009 03MT048 03MT092 01DE026 01DE037 03MT019 03MT051', '03DE007'),
    ('darius_overwhelm', 'Darius · Investida Trifariana', '01NX038 01NX012 01NX016 01NX031 01NX026 01NX033 01NX024 01NX041 02NX005 01NX019 01NX002 03NX022 01NX011', '01NX051'),
    ('shadow_rebirth', 'Ilhas das Sombras · Sacrifício e Ressurreição', '01SI043 01SI048 04SI003 01SI032 01SI020 01SI055 01SI033 02SI001 01SI049 01SI040 01SI001 01SI025 01SI003', '01SI015'),
    ('targon_support', 'Targon · Gemas e Auxílio', '03MT048 03MT092 03MT041 03MT071 03MT040 03MT038 05MT006 03MT020 07MT003 03MT019 03MT051 05MT002 05MT009', '06MT036'),
]


def add_curated_decks(payload):
    for key, title, triples, single in RECIPES:
        codes = triples.split()
        assert len(codes) == 13 and len(set(codes + [single])) == 14, key
        deck = [code for code in codes for _ in range(3)] + [single]
        assert all(payload['cards'].get(code, {}).get('collectible') for code in deck), key
        payload['decks'][key] = deck
        payload.setdefault('deckTitles', {})[key] = title
    payload['featuredDecks'] = [key for key, *_ in RECIPES] + ['summons', 'recall', 'freljord_champions']
