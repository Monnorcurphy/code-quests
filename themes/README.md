# Codename Theme Library

108 curated theme files for assigning task codenames. Each file contains 40-100+ alphabetically sorted names with broad letter coverage.

## Usage

```bash
# List all themes with counts
./core/scripts/pick-theme.sh --list

# Pick 10 names spread across the alphabet
./core/scripts/pick-theme.sh animals 10

# Pick with letter gaps (room for task splits)
./core/scripts/pick-theme.sh animals 10 --spaced

# Random selection
./core/scripts/pick-theme.sh animals 10 --random

# Show all names in a theme
./core/scripts/pick-theme.sh animals --all

# Validate codenames in a sequence file
./core/scripts/pick-theme.sh --validate specs/phase-01/sequence.md animals
```

## Integration

Set `theme:` in `factory/profile.yaml` under your phase config:

```yaml
phases:
  1:
    name: Foundation
    theme: animals
  2:
    name: Core Features
    theme: mountains
```

`slice-spec.sh` auto-resolves the theme file and passes a pre-selected name list to Claude.

## Theme Index

### Nature — Living (20 themes)

| Theme | Count | Examples |
|-------|------:|---------|
| animals | 86 | alligator, badger, camel, eagle, falcon |
| birds | 93 | albatross, blackbird, crane, dove, eagle |
| butterflies | 78 | admiral, apollo, azure, birdwing, buckeye |
| cats | 66 | abyssinian, bengal, chartreux, devon-rex, egyptian-mau |
| dinosaurs | 80 | allosaurus, brachiosaurus, carnotaurus, diplodocus, eoraptor |
| dogs | 75 | akita, basenji, collie, dalmatian, elkhound |
| fish | 84 | anchovy, barramundi, catfish, darter, eel |
| flowers | 89 | acacia, bluebell, chrysanthemum, dahlia, edelweiss |
| grasses | 70 | alfalfa, bamboo, barley, clover, fescue |
| herbs | 81 | basil, chamomile, dill, echinacea, fennel |
| horses | 65 | andalusian, brumby, clydesdale, dartmoor, friesian |
| insects | 82 | ant, beetle, cicada, dragonfly, earwig |
| mushrooms | 77 | agaric, bolete, chanterelle, death-cap, enoki |
| primates | 66 | baboon, capuchin, drill, gibbon, howler |
| reptiles | 78 | agama, basilisk, chameleon, dragon, gecko |
| seacreatures | 80 | abalone, barnacle, coral, dugong, eel |
| sharks | 68 | angel-shark, basking-shark, cookiecutter, dogfish, epaulette |
| snakes | 81 | adder, boa, cobra, diamondback, eyelash-viper |
| trees | 97 | acacia, birch, cedar, dogwood, elm |
| whales | 61 | beluga, blue-whale, cuvier, dolphin, fin-whale |

### Nature — Geography (15 themes)

| Theme | Count | Examples |
|-------|------:|---------|
| canyons | 57 | antelope, black-canyon, colca, de-chelly, fish-river |
| caves | 70 | altamira, blue-grotto, carlsbad, deer-cave, eisriesenwelt |
| deserts | 67 | atacama, black-rock, chihuahuan, dasht-e-kavir, empty-quarter |
| fjords | 70 | aurlandsfjord, baker, doubtful-sound, etne, geiranger |
| glaciers | 70 | aletsch, baltoro, columbia, fox, grey |
| islands | 91 | antigua, bali, corfu, dominica, easter |
| lakes | 78 | baikal, chad, dead-sea, erie, flathead |
| mountains | 90 | aconcagua, blanc, cook, denali, eiger |
| peninsulas | 62 | alaska, baja-california, cape-york, delmarva, eyre |
| plateaus | 65 | altiplano, bolivian, colorado, deccan, edwards |
| reefs | 65 | aldabra, barrier, coral-sea, dongsha, elkhorn |
| rivers | 88 | amazon, brahmaputra, congo, danube, elbe |
| valleys | 70 | antelope, barossa, central, death-valley, eden |
| volcanoes | 80 | agung, bromo, cotopaxi, etna, fuji |
| waterfalls | 66 | angel, ban-gioc, cascade, detian, elfin |

### Places (12 themes)

| Theme | Count | Examples |
|-------|------:|---------|
| bridges | 65 | akashi-kaikyo, brooklyn, chapel, forth, golden-gate |
| capitals | 137 | abu-dhabi, berlin, cairo, dublin, edinburgh |
| castles | 70 | alhambra, balmoral, chambord, dover, edinburgh |
| cities | 100 | amsterdam, barcelona, cairo, dubai, edinburgh |
| countries | 139 | argentina, brazil, canada, denmark, egypt |
| forts | 65 | agra-fort, bastille, citadel, denali, edinburgh |
| harbors | 72 | amsterdam, baltimore, cape-town, durban, fremantle |
| lighthouses | 67 | alcatraz, bell-rock, cape-hatteras, dunnet-head, eddystone |
| markets | 65 | borough-market, chatuchak, damnoen-saduak, fish-market, grand-bazaar |
| neighborhoods | 80 | akihabara, back-bay, chinatown, dalston, el-born |
| ruins | 75 | acropolis, borobudur, colosseum, delphi, ephesus |
| stadiums | 65 | allianz-arena, bernabeu, camp-nou, doak-campbell, eden-gardens |

### Space & Science (12 themes)

| Theme | Count | Examples |
|-------|------:|---------|
| asteroids | 65 | achilles, bennu, ceres, davida, eros |
| comets | 57 | borrelly, crommelin, donati, encke, faye |
| compounds | 70 | acetone, benzene, caffeine, dextrose, ethanol |
| constellations | 88 | andromeda, bootes, cassiopeia, draco, eridanus |
| elements | 118 | argon, boron, carbon, dysprosium, erbium |
| gemstones | 65 | agate, beryl, citrine, diamond, emerald |
| metals | 60 | aluminum, brass, chromium, damascus-steel, electrum |
| minerals | 75 | agate, barite, calcite, dolomite, epidote |
| nebulae | 60 | boomerang-nebula, carina, dumbbell, eagle, flame |
| particles | 60 | alpha-particle, baryon, charm-quark, down-quark, electron |
| planets | 48 | callisto, deimos, europa, ganymede, io |
| stars | 97 | achernar, betelgeuse, capella, deneb, electra |

### Mythology & Fantasy (10 themes)

| Theme | Count | Examples |
|-------|------:|---------|
| arthurian | 67 | arthur, bedivere, camelot, excalibur, galahad |
| egyptian | 75 | anubis, bastet, cleopatra, duat, eye-of-horus |
| folklore | 80 | anansi, baba-yaga, changeling, djinn, elves |
| legendary | 80 | achilles, beowulf, charlemagne, drake, el-cid |
| mythcreatures | 82 | basilisk, centaur, dragon, echidna, fenrir |
| mythology | 80 | achilles, brahma, calypso, diana, enki |
| norse | 78 | aegir, baldur, freyja, gungnir, heimdall |
| olympians | 79 | aphrodite, bacchus, ceres, diana, eros |
| titans | 59 | atlas, coeus, cronus, dione, epimetheus |
| zodiac | 75 | aquarius, cancer, dragon, gemini, horse |

### Transport (8 themes)

| Theme | Count | Examples |
|-------|------:|---------|
| aircraft | 80 | a-10-warthog, blackbird, concorde, dc-3, eurofighter |
| cars | 81 | alpine, barracuda, corvette, delorean, el-camino |
| helicopters | 70 | apache, bell-206, chinook, dauphin, eurocopter |
| motorcycles | 76 | aprilia, bobber, cafe-racer, ducati, electra-glide |
| rockets | 74 | agena, buran, centaur, delta, electron |
| ships | 82 | beagle, constitution, discovery, endeavour, flying-dutchman |
| submarines | 72 | akula, barracuda, corsair, daphne, echo |
| trains | 74 | acela, bernina-express, caledonian, darjeeling, eurostar |

### Human-Made Objects (12 themes)

| Theme | Count | Examples |
|-------|------:|---------|
| clocks | 60 | alarm-clock, bracket-clock, carriage-clock, digital-clock, fob-watch |
| coins | 68 | angel, bezant, crown, denarius, eagle |
| fabrics | 78 | alpaca, batiste, chambray, damask, eyelet |
| furniture | 76 | armchair, bookcase, cabinet, daybed, escritoire |
| hats | 72 | akubra, beret, cloche, derby, fedora |
| instruments | 82 | accordion, banjo, cello, dulcimer, erhu |
| knots | 65 | albright-knot, bowline, cleat-hitch, diamond-knot, eye-splice |
| lamps | 62 | arc-lamp, banker's-lamp, candelabra, desk-lamp, edison-bulb |
| pottery | 65 | amphora, bisque, celadon, delftware, earthenware |
| textiles | 72 | applique, bargello, crochet, damask, embroidery |
| tools | 79 | adze, bellows, chisel, drill, file |
| weapons | 72 | arbalest, broadsword, claymore, dagger, epee |

### Food & Drink (8 themes)

| Theme | Count | Examples |
|-------|------:|---------|
| breads | 69 | bagel, brioche, challah, damper, english-muffin |
| cheeses | 71 | brie, camembert, danbo, emmental, feta |
| cocktails | 72 | americano, boulevardier, cosmopolitan, daiquiri, espresso-martini |
| fruits | 79 | apple, banana, cherry, dragonfruit, elderberry |
| pasta | 76 | bucatini, cannelloni, ditalini, elbow, farfalle |
| spices | 74 | allspice, basil, cardamom, dill, epazote |
| teas | 66 | assam, biluochun, chamomile, darjeeling, earl-grey |
| wines | 83 | albariño, barbaresco, chablis, dolcetto, eiswein |

### Colors & Materials (5 themes)

| Theme | Count | Examples |
|-------|------:|---------|
| colors | 88 | amaranth, burgundy, cerulean, daffodil, ecru |
| leathers | 64 | aniline, bonded-leather, calfskin, deerskin, eelskin |
| pigments | 68 | alizarin-crimson, burnt-sienna, cadmium-yellow, dragon's-blood, emerald-green |
| stones | 74 | agate, basalt, chalk, diorite, eclogite |
| woods | 69 | acacia, birch, cedar, dogwood, ebony |

### Weather (4 themes)

| Theme | Count | Examples |
|-------|------:|---------|
| clouds | 59 | altocumulus, cirrus, cumulonimbus, drizzle-cloud, fog |
| storms | 61 | blizzard, cyclone, derecho, eye-wall, firestorm |
| weather | 68 | aurora, blizzard, cumulus, dew-point, el-nino |
| winds | 61 | bora, chinook, diablo, etesian, foehn |

### Culture (2 themes)

| Theme | Count | Examples |
|-------|------:|---------|
| dances | 77 | bachata, bolero, cha-cha, disco, flamenco |
| genres | 82 | ambient, bebop, country, dubstep, electronica |

## Adding Custom Themes

Create a `.txt` file in `themes/`:

```
# Theme: My Custom Theme
# Count: 50
# Category: Custom
# Description: One-line description of the theme
#
alpha
bravo
charlie
delta
echo
```

Rules:
- One name per line, lowercase, sorted alphabetically
- Use hyphens for multi-word names (`flying-dutchman`)
- Aim for 40+ names with good A-Z letter coverage
- Header comments are optional but recommended for `--list` display
- Update the `# Count:` header to match the actual count
