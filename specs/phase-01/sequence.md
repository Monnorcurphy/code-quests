# Phase 1: Town Skeleton (HUD only)
# Theme: castles
#
# codename       spec-file                                  depends         touches
alhambra         task-alhambra-monorepo-setup.md            -               all
arundel          task-arundel-sqlite-schema.md              alhambra        backend
ashford          task-ashford-shared-types.md               arundel         shared
balmoral         task-balmoral-express-api.md               ashford         backend
bodiam           task-bodiam-react-hud.md                   balmoral        frontend
bran             task-bran-adventurer-recruit.md            bodiam          all
caernarfon       task-caernarfon-quest-board-capstone.md    bran            all
