const { assign } = Object
const { abs, floor, ceil, min, max, sqrt, atan2, PI, random } = Math

import Two from './two.min.mjs'
import * as utils from './utils.mjs'
const { Group, GameAudio, addTo, urlAbsPath, addToLoads, checkAllLoadsDone, checkHit } = utils

const WIDTH = 800
const HEIGHT = 600
const FPS = 60  // hardcoded in Twojs
const BACKGROUND_COLOR = "#111"

const scaleGame = nbPlayers => min(1, sqrt(4/(nbPlayers+2)))

const HERO_WIDTH = nbPlayers => 80 * scaleGame(nbPlayers)

const MONSTER_WIDTH = 80
const MONSTER_SPEED = 40
const MONSTER_POP_PERIOD = nbMonsters => nbMonsters / 2

const GAME_DURATION = 180


function startGame(wrapperEl, gameWs) {
  return new Game(wrapperEl, gameWs)
}


class Game extends Two {

  constructor(wrapperEl, gameWs) {
    super({
      type: Two.Types.webgl,
      width: WIDTH,
      height: HEIGHT,
    })
    utils.fitTwoToEl(this, wrapperEl, { background: BACKGROUND_COLOR })

    this.roomId = gameWs.roomId
    this.joypadUrl = gameWs.joypadUrl
    this.joypadUrlQrCode = gameWs.joypadUrlQrCode
    this.sendInput = gameWs.sendInput
    this.sendState = gameWs.sendState

    this.players = {}

    this.sceneGroup = addTo(this, new Group())
    this.setScene(new GameScene(this))
  
    this.bind("update", (frameCount, timeDelta) => {
      const time = frameCount / FPS
      this.mainScene.update(time)
    })
    
    this.play()
  }

  syncPlayers(players) {
    try {
      this.players = players
      this.mainScene.syncPlayers()
    } catch(err) {
      console.log(err)
    }
  }

  onJoypadInput(playerId, kwargs) {
    try {
      this.mainScene.onJoypadInput(playerId, kwargs)
    } catch(err) {
      console.log(err)
    }
  }

  setScene(scn) {
    if(this.mainScene !== undefined) this.mainScene.remove()
    this.mainScene = addTo(this.sceneGroup, scn)
  }
}


// Silly Fun by Kevin MacLeod | https://incompetech.com/
// Music promoted by https://www.chosic.com/free-music/all/
// Creative Commons CC BY 3.0
// https://creativecommons.org/licenses/by/3.0/
const music = addToLoads(new GameAudio(urlAbsPath("assets/Silly-Fun.opus"), { volume: .2 }))

const elecAud = addToLoads(new GameAudio(urlAbsPath("assets/electrocute.opus"), { volume: 1 }))
const fartAud = addToLoads(new GameAudio(urlAbsPath("assets/fart.opus"), { volume: 1 }))
const popAud = addToLoads(new GameAudio(urlAbsPath("assets/pop.mp3"), { volume: .5 }))




class GameScene extends Group {

  constructor(game) {
    super()
    this.game = game

    this.nbPlayers = 0

    this.background = addTo(this, new Group())
    this.monsters = addTo(this, new Group())
    this.heros = addTo(this, new Group())
    this.others = addTo(this, new Group())
    this.notifs = addTo(this, new Group())

    this.addLoadingTexts()
  }

  addLoadingTexts() {
    this.loadingTexts = addTo(this.notifs, new Group())
    addTo(this.loadingTexts, new Two.Text(
      "LOADING...",
      WIDTH / 2, HEIGHT / 2, { fill: "white", size: 20 }
    ))
  }

  checkReady() {
    if(!this.ready && checkAllLoadsDone()) {
      this.ready = true
      this.loadingTexts.remove()
      this.setStep("INTRO")
    }
    return this.ready
  }

  setStep(step) {
    if(!this.ready || step === this.step) return
    this.step = step
    if(step === "INTRO") {
      this.addBackground()
      this.syncPlayers()
      this.addIntroTexts()
      music.currentTime = 0; music.play({ loop: true })
    } else if(step === "GAME") {
      this.gameTime = this.time
      this.introTexts.remove()
      addTo(this.notifs, new CountDown(3))
      this.nextMonsterTime = this.time + 3
      this.scoresPanel = addTo(this.notifs, new ScoresPanel(this))
    } else if(step === "VICTORY") {
      this.addVictoryTexts()
    }
    this.game.sendState({ step })
  }

  update(time) {
    if(!this.checkReady()) return
    this.startTime ||= time
    this.time = time - this.startTime
    const { step } = this
    if(step === "INTRO" || step === "GAME") {
      this.heros.update(this.time)
    }
    if(step === "GAME") {
      this.others.update(this.time)
      this.monsters.update(this.time)
      this.monsters.children.sort((a, b) => a.translation.y - b.translation.y)
      this.mayAddMonster()
      if(this.time - this.gameTime > GAME_DURATION) this.setStep("VICTORY")
    }
    this.notifs.update(this.time)
  }

  addBackground() {
    const background = addTo(this.background, new Two.Sprite(
      urlAbsPath("assets/background.jpg"),
      WIDTH / 2, HEIGHT / 2,
    ))
    background.scale = 2.5
  }

  addIntroTexts() {
    this.introTexts = addTo(this.notifs, new Group())
    const textArgs = { size: 30, fill: "black", alignment: "center" }
    addTo(this.introTexts, new Two.Text(
      "M.A.T.H.",
      WIDTH / 2, HEIGHT / 2 - 200,
      { ...textArgs, size: 60 }
    ))
    addTo(this.introTexts, new Two.Text(
      "Join the game:",
      WIDTH / 2, HEIGHT / 2 - 130,
      { ...textArgs, size: 40 }
    ))
    addTo(this.introTexts, new Two.Sprite(
      new Two.Texture(this.game.joypadUrlQrCode),
      WIDTH / 2, HEIGHT / 2,
    )).scale = 200 / 200
    addTo(this.introTexts, new Two.Text(
      this.game.joypadUrl,
      WIDTH / 2, HEIGHT / 2 + 130,
      textArgs
    ))
  }

  syncPlayers() {
    if(!this.ready) return
    for(const playerId in this.game.players) if(this.step === "INTRO" && !this.getHero(playerId)) this.addHero(playerId)
    for(const hero of this.heros.children) if(!this.game.players[hero.playerId]) this.rmHero(hero.playerId)
    this.nbPlayers = Object.keys(this.game.players).length
  }
  addHero(playerId) {
    addTo(this.heros, new Hero(
      this,
      playerId,
    ))
  }
  getHero(playerId) {
    const res = this.heros.children.filter(h => h.playerId === playerId)
    return res ? res[0] : null
  }
  rmHero(playerId) {
    this.getHero(playerId).remove()
  }

  mayAddMonster() {
    if(this.time > this.nextMonsterTime) {
      addTo(this.monsters, new Monster(this))
      this.nextMonsterTime = this.time + MONSTER_POP_PERIOD(this.monsters.children.filter(m => !m.dead).length)
    }
  }

  addVictoryTexts() {
    let winnerHero = this.heros.children[0]
    for(let hero of this.heros.children) if(hero.score > winnerHero.score) winnerHero = hero
    const player = this.game.players[winnerHero.playerId]
    const txtArgs = { fill: "black" }
    this.victoryTexts = addTo(this.notifs, new Group())
    addTo(this.victoryTexts, new Two.Text(
      "VICTORY !",
      WIDTH / 2, HEIGHT / 3,
      { ...txtArgs, size: 80 }
    ))
    addTo(this.victoryTexts, new Two.Text(
      `Winner: ${player.name}`,
      WIDTH / 2, HEIGHT / 2,
      { ...txtArgs, size: 40 }
    ))
  }

  onJoypadInput(playerId, kwargs) {
    const hero = this.getHero(playerId)
    hero.onJoypadInput(kwargs)
    if(kwargs.ready !== undefined) {
      if(this.step === "INTRO") this.setHeroReady(hero, kwargs.ready)
    }
    if(kwargs.restart) {
      if(this.step === "VICTORY") this.restart()
    }
  }

  setHeroReady(hero, ready) {
    hero.ready = ready
    if(this.step === "INTRO") {
      let allReady = true
      for(const h of this.heros.children) allReady &= h.ready
      if(allReady) this.setStep("GAME")
    }
  }

  restart() {
    this.game.setScene(new GameScene(this.game))
  }

  remove() {
    super.remove()
    music.pause()
  }
}


const heroCanvas = {
  base: addToLoads(utils.newCanvasFromSrc(urlAbsPath("assets/hero.png"))),
  colors: addToLoads(utils.newCanvasFromSrc(urlAbsPath("assets/hero_colors.png"))),
  get: function(frame, color) {
    const key = `trans:${frame}:${color}`
    if(!this[key]) {
      this[key] = utils.cloneCanvas(this.base, { col: [frame, 2] })
      utils.colorizeCanvas(this[key], color)
      const colors = utils.cloneCanvas(this.colors, { col: [frame, 2] })
      utils.addCanvas(this[key], colors)
    }
    return this[key]
  }
}


class Hero extends Group {

  constructor(scn, playerId) {
    super()
    this.scene = scn
    this.game = scn.game
    this.playerId = playerId
    this.player = this.game.players[playerId]
    const { name, color } = this.player

    this.translation.x = 50
    this.score = 0
    this.imgAttackEndTime = 0

    this.img = addTo(this, new Two.ImageSequence([
      new Two.Texture(heroCanvas.get(0, color)),
      new Two.Texture(heroCanvas.get(1, color)),
    ], 0, 0))

    this.nameText = addTo(this, new Two.Text(
      name,
      0, 0,
      { fill: "black", size: 30 }
    ))

    this.syncNbPlayers()
  }

  syncNbPlayers() {
    const nbPlayers = this.scene.nbPlayers
    if(nbPlayers === this.prevNbPlayers)
    this.prevNbPlayers = nbPlayers
    const numPlayer = this.scene.heros.children.indexOf(this)
    this.translation.y = HEIGHT / (nbPlayers + 1) * (1 + numPlayer)
    this.width = HERO_WIDTH(nbPlayers)
    this.height = this.width * 125 / 100
    this.img.scale = this.width / 100
    this.nameText.translation.y = this.height / 2 + 20
  }

  update(time) {
    this.time = time
    this.syncNbPlayers()
    this.img.index = (time > this.imgAttackEndTime) ? 0 : 1
  }

  onJoypadInput(kwargs) {
    if(kwargs.attack !== undefined) {
      this.tryAttack(kwargs.attack)
    }
  }

  tryAttack(val) {
    const monsters = []
    for(const m of this.scene.monsters.children) if(!m.dead) monsters.push(m)
    monsters.sort((a, b) => a.translation.x - b.translation.x)
    for(const m of this.scene.monsters.children) if(m.dead) monsters.push(m)
    const currentMonsters = []
    const _tryAttack = remVal => {
      for(const monster of monsters) {
        if(currentMonsters.indexOf(monster) >= 0) continue
        if(remVal < monster.value) continue
        else if(remVal === monster.value) {
          const attackedMonsters = [...currentMonsters, monster]
          return attackedMonsters
        } else {
          currentMonsters.push(monster)
          const attackdMonsters = _tryAttack(remVal - monster.value)
          if(attackdMonsters) return attackdMonsters
          currentMonsters.pop()
        }
      }
    }
    const attackedMonsters = _tryAttack(val)
    if(attackedMonsters) {
      this.imgAttackEndTime = this.time + .5
      this.attack(attackedMonsters)
    } else {
      this.imgAttackEndTime = this.time + 1
      addTo(this.scene.others, new Fart(this.translation.x + 30, this.translation.y - 50, this.player.color))
      addTo(this.scene.others, new Drop(this.translation.x - 10, this.translation.y))
      fartAud.currentTime = 0; fartAud.play()
    }
  }

  attack(attackedMonsters) {
    this.score += this.getAttackScore(attackedMonsters)
    this.scene.scoresPanel.syncScores()
    let prevLightningTarget = {
      x: this.translation.x + 30,
      y: this.translation.y - 30,
    }
    for(let monster of attackedMonsters) {
      monster.onAttacked()
      addTo(this.scene.others, new Lightning(prevLightningTarget, monster.translation, this.player.color))
      prevLightningTarget = monster.translation
    }
    elecAud.currentTime = 0; elecAud.play()
  }

  getAttackScore(attackedMonsters) {
    // dead monsters provide no score
    const aliveMonsters = attackedMonsters.filter(m => !m.dead)
    const nbAliveMonsters = aliveMonsters.length
    let score = nbAliveMonsters * (nbAliveMonsters + 1) / 2
    // already attacked monsters have score malus
    const nbAttackersMonsters = aliveMonsters.filter(m => m.attackers.indexOf(this) >= 0).length
    score -= nbAttackersMonsters
    return score
  }
}


const fartCanvas = {
  base: addToLoads(utils.newCanvasFromSrc(urlAbsPath("assets/cloud.png"))),
  get: function(color) {
    const key = `trans:${color}`
    if(!this[key]) {
      this[key] = utils.cloneCanvas(this.base)
      utils.colorizeCanvas(this[key], color)
    }
    return this[key]
  }
}


class Fart extends Two.Sprite {
  constructor(x, y, color) {
    super(new Two.Texture(fartCanvas.get(color)), x, y)
    this.scale = 50 / 100
  }
  update(time) {
    this.startTime ||= time
    this.translation.y -= 10 / FPS
    if(time - this.startTime > 1) this.remove()
  }
}


class Drop extends Two.Sprite {
  constructor(x, y) {
    super(urlAbsPath("assets/drop.png"), x, y)
    this.scale = 20 / 100
  }
  update(time) {
    this.rmTime ||= time + 1
    this.translation.y += 20 / FPS * max(0, this.rmTime - time)
    if(time > this.rmTime) this.remove()
  }
}


class Pop extends Two.Sprite {
  constructor(x, y) {
    super(urlAbsPath("assets/pop.png"), x, y)
    this.scale = 50 / 100
  }
  update(time) {
    this.startTime ||= time
    this.scale = (50 + 1000 * (time - this.startTime)) / 100
    if(time > this.startTime + .20) this.remove()
  }
}


const monsterCanvas = {
  base: addToLoads(utils.newCanvasFromSrc(urlAbsPath("assets/monster.png"))),
  getDead: function() {
    if(!this.dead) {
      this.dead = utils.cloneCanvas(this.base)
      utils.colorizeCanvas(this.dead, "black")
    }
    return this.dead
  }
}


class Monster extends Group {

  constructor(scn) {
    super()
    this.scene = scn
    this.game = scn.game
    this.scale = MONSTER_WIDTH / 200
    this.translation.x = WIDTH - 75 + 50 * random()
    this.translation.y = (HEIGHT - 2 * MONSTER_WIDTH) * random() + MONSTER_WIDTH

    this.value = floor(random() * 9) + 1
    this.life = this.scene.nbPlayers

    this.attackers = []

    this.bodyImg = addTo(this, new Two.ImageSequence([
      new Two.Texture(monsterCanvas.base),
      new Two.Texture(monsterCanvas.getDead()),
    ]))
    this.digitImg = addTo(this, new Two.Text(this.value, 0, 70, {
      fill: "black", size: 100
    }))

    this.setStepNormal()

    popAud.currentTime = 0; popAud.play()
    addTo(this.scene.others, new Pop(this.translation.x, this.translation.y))
  }

  update(time) {
    this.stepUpdate(time)
  }

  setStepNormal() {
    this.stepUpdate = time => {
      this.translation.x -= MONSTER_SPEED / FPS
      if(this.translation.x < 100) {
        this.remove()
        fartAud.currentTime = 0; fartAud.play()
      }
    }
  }

  setStepDead() {
    if(this.dead) return
    this.dead = true
    this.bodyImg.index = 1
    this.digitImg.fill = "white"
    this.stepUpdate = time => {
      this.rmTime ||= time + 3
      if(time >= this.rmTime) this.remove()
      this.opacity = max(0, min(1, this.rmTime - time))
    }
  }

  onAttacked(attacker) {
    if(this.attackers.indexOf(attacker) < 0) this.attackers.push(attacker)
    this.life -= 1
    if(this.life <= 0) this.setStepDead()
  }
}


const lightningCanvas = {
  base: addToLoads(utils.newCanvasFromSrc(urlAbsPath("assets/lightning.png"))),
  get: function(num, color) {
    const key = `trans:${num}:${color}`
    if(!this[key]) {
      this[key] = utils.cloneCanvas(this.base, { col: [num,8] })
      utils.colorizeCanvas(this[key], color)
    }
    return this[key]
  }
}


class Lightning extends Group {
  constructor(target1, target2, color) {
    super()
    const { x: x1, y: y1 } = target1
    const { x: x2, y: y2 } = target2
    const dx = x2 - x1, dy = y2 - y1, dist = sqrt(dx*dx + dy*dy)
    const nbLightnings = ceil(dist/100)
    for(let i=0; i<nbLightnings; ++i) {
      const img = addTo(this, new Two.ImageSequence(
        range(8).map(j => new Two.Texture(lightningCanvas.get(j, color))),
        0, i * 100 - (nbLightnings-1)*50,
        20
      ))
      img.scale = 100 / 512
      img.play()
    }
    this.translation.x = (x1 + x2) / 2
    this.translation.y = (y1 + y2) / 2
    this.scale = dist / (100 * nbLightnings)
    this.rotation = atan2(dy, dx) + PI/2
  }
  update(time) {
    this.startTime ||= time
    if(time > this.startTime + .5) this.remove()
  }
}


class CountDown extends Group {

  constructor(startVal, next) {
    super()
    this.translation.x = WIDTH / 2
    this.translation.y = HEIGHT / 2
    this.startVal = startVal
    this.val = startVal + 1
    this.next = next
  }

  update(time) {
    super.update(time)
    this.startTime ||= time
    const age = time - this.startTime
    if(age > this.startVal - this.val + 1) {
      this.val -= 1
      this.addNumber()
    }
    if(age > this.startVal) {
      this.remove()
      this.next && this.next()
    }
  }

  addNumber() {
    const number = addTo(this, new Two.Text(this.val, 0, 0, {
      fill: "black", size: 100
    }))
    number.update = function(time) {
      this.startTime ||= time
      const age = time - this.startTime
      this.scale = 1 + age * 6
      if(age > .5) this.remove()
    }
  }
}


class ScoresPanel extends Group {

  constructor(scn) {
    super()
    this.scene = scn
    this.game = scn.game
    this.heros = scn.heros.children
    this.nbScores = min(10, this.heros.length)

    this.translation.x = 10
    this.translation.y = 10
    this.width = 160
    this.height = (this.nbScores) * 25 + 15

    const background = addTo(this, new Two.Rectangle(this.width/2, this.height/2, this.width, this.height))
    background.fill = 'rgba(0, 0, 0, 0.2)'

    this.scoreTexts = addTo(this, new Group())
    for(let i=0; i<this.nbScores; ++i) {
      addTo(this.scoreTexts, new Two.Text(
        "",
        this.width/2, 20 + i * 25,
        { fill: "black", size: 24 }
      ))
    }

    this.syncScores()
  }

  syncScores() {
    const sortedHeros = [...this.heros]
    sortedHeros.sort((h1, h2) => {
      if(h1.score > h2.score) return -1
      if(h1.score < h2.score) return 1
      const p1 = this.game.players[h1.playerId]
      const p2 = this.game.players[h1.playerId]
      if(p1.name > p2.name) return -1
      if(p1.name < p2.name) return 1
      return 0
    })
    for(let i=0; i<this.nbScores; ++i) {
      let txt = ""
      if(i < sortedHeros.length) {
        const hero = sortedHeros[i]
        const player = this.game.players[hero.playerId]
        txt = `${player.name}: ${hero.score}`
      }
      this.scoreTexts.children[i].value = txt
    }
  }
}


// utils //////////////////////////


class Notif extends Two.Text {

  constructor(txt, x, y, textKwargs) {
    super(
      txt, x, y,
      { size: 30, ...textKwargs }
    )
  }

  update(time) {
    this.translation.y -= 50 / FPS
    this.removeTime ||= time + 1
    if(time > this.removeTime) this.remove()
  }
}

function range(n) {
  return [...Array(n).keys()]
}


function getDist(ent1, ent2) {
  const { x: x1, y: y1 } = ent1.translation
  const { x: x2, y: y2 } = ent2.translation
  const dx = x2 - x1, dy = y2 - y1
  return sqrt(dx*dx + dy*dy)
}


export { startGame }
