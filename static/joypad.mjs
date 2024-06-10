const { assign } = Object
const { floor, min } = Math

import Two from './two.min.mjs'
import * as utils from './utils.mjs'
const { Group, addTo, urlAbsPath, addToLoads, checkAllLoadsDone, checkHit } = utils

const WIDTH = 800
const HEIGHT = 450
const FPS = 60  // hardcoded in Twojs
const BACKGROUND_COLOR = "#111"

const DIGIT_BUTTON_SIZE = 100


function startJoypad(wrapperEl, playerWs) {
  return new Joypad(wrapperEl, playerWs)
}


class Joypad extends Two {

  constructor(wrapperEl, playerWs) {
    super({
      type: Two.Types.webgl,
      width: WIDTH,
      height: HEIGHT,
    })
    utils.fitTwoToEl(this, wrapperEl, { background: BACKGROUND_COLOR })

    this.player = playerWs.player
    this.sendInput = playerWs.sendInput
  
    this.pointer = utils.newPointer(this)

    this.sceneGroup = addTo(this, new Group())
    this.setScene(new JoypadScene(this))
  
    this.pointer.prevIsDown = false
    this.bind("update", (frameCount, timeDelta) => {
      const time = frameCount / FPS
      if(this.pointer.isDown) this.mainScene.click(this.pointer)
      this.mainScene.update(time)
      this.pointer.prevIsDown = this.pointer.isDown
    })

    this.play()
  }

  onGameInput(kwargs) {
    try {
      this.mainScene.onGameInput(kwargs)
    } catch(err) {
      console.log(err)
    }
  }

  onGameState(gameState) {
    this.gameState = gameState
    try {
      this.mainScene.onGameState(gameState)
    } catch(err) {
      console.log(err)
    }
  }
  
  setScene(scn) {
    if(this.mainScene !== undefined) this.mainScene.remove()
    this.mainScene = addTo(this.sceneGroup, scn)
  }
}


class JoypadScene extends Group {

  constructor(joypad) {
    super()
    this.joypad = joypad

    this.buttons = addTo(this, new Group())
    this.notifs = addTo(this, new Group())

    this.addLoadingTexts()
  }

  addLoadingTexts() {
    this.loadingTexts = addTo(this.notifs, new Group())
    addTo(this.loadingTexts, new Two.Text(
      "LOADING...",
      WIDTH / 2, HEIGHT / 2, { fill: "white", size: 50 }
    ))
  }

  chechReady() {
    if(!this.ready && checkAllLoadsDone()) {
      this.ready = true
      this.loadingTexts.visible = false
      this.initSprites()
      const step = this.joypad.gameState ? this.joypad.gameState.step : "WAITING"
      this.setStep(step)
    }
    return this.ready
  }

  initSprites() {
    this.addWaitingTexts()
    this.addDigitButtons()
    this.addValueText()
    this.addReadyButton()
    this.addRestartButton()
  }

  addWaitingTexts() {
    this.waitingTexts = addTo(this.notifs, new Group())
    addTo(this.waitingTexts, new Two.Text(
      "WAITING FOR NEW GAME...",
      WIDTH / 2, HEIGHT / 2, { fill: this.joypad.player.color, size: 40 }
    ))
    this.waitingTexts.visible = false
  }

  // addArrowButtons() {
  //   this.arrowButtons = []
  //   for(const dir of [0, 1]) {
  //     const btn = addTo(this.buttons, new ArrowButton(this, dir))
  //     btn.visible = false
  //     this.arrowButtons.push(btn)
  //   }
  // }

  addDigitButtons() {
    this.digitButtons = []
    let btn
    const x = i => WIDTH / 2 + DIGIT_BUTTON_SIZE / 2 + (i-2) * DIGIT_BUTTON_SIZE
    const y = j => HEIGHT / 2 + DIGIT_BUTTON_SIZE / 2 + (j-1) * DIGIT_BUTTON_SIZE
    for(let i=1; i<=3; ++i) {
      for(let j=0; j<=2; ++j) {
        const val = i + 3 * j
        btn = addTo(this.buttons, new DigitButton(this, x(i), y(j), val))
        btn.visible = false
        this.digitButtons.push(btn)
      }
    }
    btn = addTo(this.buttons, new DigitButton(this, x(0), y(0), "❌"))
    btn.visible = false
    this.digitButtons.push(btn)
    btn = addTo(this.buttons, new DigitButton(this, x(0), y(1), 0))
    btn.visible = false
    this.digitButtons.push(btn)
    btn = addTo(this.buttons, new DigitButton(this, x(0), y(2), "✔️"))
    btn.visible = false
    this.digitButtons.push(btn)
  }
  
  addValueText() {
    this.valueText = addTo(this, new Two.Text("", WIDTH/2, 75, {
      fill: "white",
      size: 50
    }))
    this.valueText.visible = false
  }

  addReadyButton() {
    this.readyButton = addTo(this.buttons, new ReadyButton(this, WIDTH/2, 75))
    this.readyButton.visible = false
  }

  addRestartButton() {
    this.restartButton = addTo(this.buttons, new RestartButton(this, WIDTH/2, 75))
    this.restartButton.visible = false
  }

  setStep(step) {
    if(!this.step || this.step === "WAITING") {
      if(step !== "INTRO") step = "WAITING"
    }
    if(!this.ready || step === this.step) return
    this.step = step

    this.waitingTexts.visible = step === "WAITING"
    for(const btn of this.digitButtons) btn.visible = (step === "INTRO" || step === "GAME" || step === "VICTORY")
    this.valueText.visible = step === "GAME"
    this.readyButton.visible = step === "INTRO"
    this.readyButton.setReady(false)
    this.restartButton.visible = false
    this.timeForRestartButton = null
  }

  update(time) {
    if(!this.chechReady()) return
    super.update(time)
    if(this.step === "VICTORY") {
      this.timeForRestartButton ||= time + 3
      if(time > this.timeForRestartButton) this.restartButton.visible = true
    }
  }

  click(pointer) {
    if(!this.ready) return
    const btns = this.buttons.children
    for(let i=btns.length-1; i>=0; i--) {
      const but = btns[i]
      if(!but.visible) continue
      if(checkHit(pointer, but)) {
        but.click(pointer)
        return
      }
    }
  }

  onGameInput(kwargs) {}

  onGameState(gameState) {
    this.setStep(gameState.step)
  }
}


const arrowCanvas = {
  base: addToLoads(utils.newCanvasFromSrc(urlAbsPath("assets/joypad_arrow.png"))),
  baseClicked: addToLoads(utils.newCanvasFromSrc(urlAbsPath("assets/joypad_arrow_clicked.png"))),
  get: function(dir, clicked, color) {
    const key = `trans:${dir},${clicked}`
    if(!this[key]) {
      const base = clicked ? this.baseClicked : this.base
      this[key] = utils.cloneCanvas(base, { flipX: (dir === 1)})
      if(color) utils.colorizeCanvas(this[key], color)
    }
    return this[key]
  }
}


// class ArrowButton extends Two.ImageSequence {
//   constructor(scn, dir) {
//     super(
//       [
//         new Two.Texture(arrowCanvas.get(dir, false, scn.joypad.player.color)),
//         new Two.Texture(arrowCanvas.get(dir, true, scn.joypad.player.color)),
//       ],
//       WIDTH / 4 * (dir ? 3 : 1),
//       HEIGHT / 2
//     )
//     this.scale = min(WIDTH / 2, HEIGHT) / 200 * .8
//     this.scene = scn
//     this.joypad = scn.joypad
//     this.dir = dir
//     this.lastClickTime = -1
//   }
//   update(time) {
//     this.time = time
//     this.index = this.time > this.lastClickTime + .1 ? 0 : 1
//   }
//   getHitBox() {
//     return {
//       left: this.dir ? WIDTH / 2 : 0,
//       top: 0,
//       width: WIDTH / 2,
//       height: HEIGHT,
//     }
//   }
//   click(pointer) {
//     this.lastClickTime = this.time
//     if(!pointer.prevIsDown) this.joypad.sendInput({ dir: this.dir })
//   }
// }


const buttonCanvas = {
  base: addToLoads(utils.newCanvasFromSrc(urlAbsPath("assets/button.png"))),
  get: function(width, color, clicked) {
    const key = `trans:${width}:${color}:${clicked}`
    if(!this[key]) {
      this[key] = document.createElement("canvas")
      assign(this[key], { width, height: 100 })
      const ctx = this[key].getContext("2d")
      const sx = clicked ? 150 : 0
      ctx.drawImage(this.base, sx, 0, 50, 100, 0, 0, 50, 100)
      for(let i=0; i<floor((width-100)/50); ++i)
        ctx.drawImage(this.base, sx+50, 0, 50, 100, (i+1)*50, 0, 50, 100)
      ctx.drawImage(this.base, sx+50, 0, 50, 100, width-100, 0, 50, 100)
      ctx.drawImage(this.base, sx+100, 0, 50, 100, width-50, 0, 50, 100)
      utils.colorizeCanvas(this[key], color)
    }
    return this[key]
  }
}


class TextButton extends Group {
  constructor(text, color, x, y, kwargs) {
    super()
    const textColor = kwargs && kwargs.textColor || "white"
    const textSize = kwargs && kwargs.textSize || 40
    assign(this.translation, { x, y })
    const textSprite = new Two.Text(
      text, 0, 5, { fill: textColor, size: textSize, weight: 1000 }
    )
    const { width: txtWidth, height: textHeight } = Two.Text.Measure(textSprite)
    this.buttonSprite = addTo(this, new Two.ImageSequence([
      new Two.Texture(buttonCanvas.get(txtWidth+75, color, false)),
      new Two.Texture(buttonCanvas.get(txtWidth+75, color, true)),
    ]))
    addTo(this, textSprite)
    this.time = 0
    this.lastClickTime = -1
  }

  click(pointer) {
    this.lastClickTime = this.time
  }

  update(time) {
    this.time = time
    this.buttonSprite.index = (time < this.lastClickTime + .1) ? 1 : 0
  }
}


class DigitButton extends TextButton {
  constructor(scn, x, y, val) {
    super(val, "lightgrey", x, y)
    this.scene = scn
    this.joypad = scn.joypad
    this.val = val
  }
  click(pointer) {
    if(pointer.prevIsDown) return
    if(typeof this.val === 'number') {
      let value = this.scene.valueText.value
      if(value === "") value = 0
      value = value * 10 + this.val
      this.scene.valueText.value = value
    } else if(this.val === "❌") {
      this.scene.valueText.value = ""
    } else if(this.val === "✔️") {
      this.joypad.sendInput({ attack: this.scene.valueText.value })
      this.scene.valueText.value = ""
    }
  }
}


class ReadyButton extends Group {
  constructor(scn, x, y) {
    super()
    this.scene = scn
    this.joypad = scn.joypad
    assign(this.translation, { x, y })
    this.notReadyButton = addTo(this, new TextButton("READY ?", "yellow", 0, 0))
    this.readyButton = addTo(this, new TextButton("READY ✔️", "green", 0, 0))
    this.readyButton.visible = false
    this.ready = false
  }
  click(pointer) {
    if(!pointer.prevIsDown) {
      this.setReady(!this.ready)
      this.joypad.sendInput({ ready: this.ready })
    }
  }
  setReady(val) {
    this.ready = val
    this.notReadyButton.visible = !this.ready
    this.readyButton.visible = this.ready
  }
}


class RestartButton extends TextButton {
  constructor(scn, x, y) {
    super("RESTART", "yellow", x, y)
    this.scene = scn
    this.joypad = scn.joypad
  }
  click(pointer) {
    super.click(pointer)
    if(!pointer.prevIsDown) {
      this.joypad.sendInput({ restart: true })
    }
  }
}


export { startJoypad }
