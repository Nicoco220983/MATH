const { assign } = Object

import Two from './two.min.mjs'


class Group extends Two.Group {
    update(time) {
        this.children.forEach(s => s.update && s.update(time))
    }
}


class GameAudio extends Audio {
  constructor(src, kwargs) {
    super(src)
    this.preload = "auto"
    assign(this, kwargs)
    this.oncanplaythrough = () => this.loaded = true
  }
  play(kwargs) {
    this.loop = (kwargs && kwargs.loop) === true
    super.play()
  }
  replay() {
    this.pause()
    this.currentTime = 0
    this.play()
  }
}


function addTo(group, obj) {
  group.add(obj)
  return obj
}


function urlAbsPath(relPath){
  const url = new URL(relPath, import.meta.url)
  return url.pathname
}


function fitTwoToEl(two, wrapperEl, kwargs) {

    const { width, height } = two
    const backgroundColor = (kwargs && kwargs.background) || "black"
    const parentEl = wrapperEl.parentElement

    wrapperEl.style.aspectRatio = `${width}/${height}`
    function fillSpace() {
        const fitToWidth = (width/height > parentEl.clientWidth/parentEl.clientHeight)
        wrapperEl.style.width = fitToWidth ? "100%" : "auto"
        wrapperEl.style.height = fitToWidth ? "auto" : "100%"
    }
    fillSpace()
    window.addEventListener("resize", fillSpace)

    two.appendTo(wrapperEl)
    assign(two.renderer.domElement.style, {
        width: "100%",
        height: "100%",
        backgroundColor,
    })
}


function newPointer(two) {

    const el = two.renderer.domElement

    const pointer = {
        isDown: false,
        x: null,
        y: null
    }
    function _updPointer(isDown, pos) {
        const rect = el.getBoundingClientRect()
        assign(pointer, {
            isDown: isDown === null ? pointer.isDown : isDown,
            x: pos ? (pos.clientX - rect.left) * two.width / rect.width : null,
            y: pos ? (pos.clientY - rect.top) * two.height / rect.height : null,
        })
    }

    el.addEventListener("mousemove", evt => _updPointer(null, evt))
    el.addEventListener("touchmove", evt => _updPointer(true, evt.changedTouches[0]))
    el.addEventListener("mousedown", evt => _updPointer(true, evt))
    el.addEventListener("touchstart", evt => _updPointer(true, evt.changedTouches[0]))
    el.addEventListener("mouseup", evt => _updPointer(false, null))
    el.addEventListener("touchend", evt => {
        if(evt.touches.length === 0) _updPointer(false, null)
        else _updPointer(true, evt.touches[0])
    })

    return pointer
}


const Loads = []

function addToLoads(obj) {
    Loads.push(obj)
    return obj
}

function checkAllLoadsDone() {
    for(const o of Loads)
        if(!o.loaded)
            return false
    Loads.length = 0
    return true
}

function newCanvas(width, height, color) {
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    if(color) {
        const ctx = canvas.getContext("2d")
        ctx.fillStyle = color
        ctx.fillRect(0, 0, width, height)
    }
    return canvas
}

function newCanvasFromSrc(src) {
    const canvas = document.createElement("canvas")
    const img = document.createElement("img")
    img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.loaded = true
    }
    img.onerror = console.error
    img.src = src
    // _enrichCanvas(canvas)
    return canvas
}

function cloneCanvas(canvas, kwargs) {
    const flipX = (kwargs && kwargs.flipX) || false
    const flipY = (kwargs && kwargs.flipY) || false
    const scaleX = (kwargs && kwargs.scaleX) || 1
    const scaleY = (kwargs && kwargs.scaleY) || 1
    const numCol = (kwargs && kwargs.col && kwargs.col[0]) || 0
    const nbCols = (kwargs && kwargs.col && kwargs.col[1]) || 1
    const numRow = (kwargs && kwargs.row && kwargs.row[0]) || 0
    const nbRows = (kwargs && kwargs.row && kwargs.row[1]) || 1
    const dx = (kwargs && kwargs.dx) || 0
    const dy = (kwargs && kwargs.dy) || 0
    const width = (kwargs && kwargs.width) || canvas.width * scaleX / nbCols
    const height = (kwargs && kwargs.height) || canvas.height * scaleY / nbRows
    const res = document.createElement("canvas")
    assign(res, { width, height })
    const ctx = res.getContext("2d")
    ctx.save()
    if(flipX) {
        ctx.translate(width, 0)
        ctx.scale(-1, 1)
    }
    if(flipY) {
        ctx.translate(0, height)
        ctx.scale(1, -1)
    }
    if(numCol !== 0 || dx !== 0) ctx.translate(dx - width * numCol, 0)
    if(numRow !== 0 || dy !== 0) ctx.translate(0, dy - height * numRow)
    if(scaleX !== 1) ctx.scale(scaleX, 1)
    if(scaleY !== 1) ctx.scale(1, scaleY)
    ctx.drawImage(canvas, 0, 0)
    ctx.restore()
    return res
}

function colorizeCanvas(canvas, color) {
    const { width, height } = canvas
    const colorCanvas = newCanvas(width, height, color)
    const colorCtx = colorCanvas.getContext("2d")
    colorCtx.globalCompositeOperation = "destination-in"
    colorCtx.drawImage(canvas, 0, 0, width, height)
    const ctx = canvas.getContext("2d")
    ctx.save()
    ctx.globalCompositeOperation = "color"
    ctx.drawImage(colorCanvas, 0, 0, width, height)
    ctx.restore()
}

function addCanvas(canvas, canvas2, x=0, y=0) {
    const ctx = canvas.getContext("2d")
    ctx.drawImage(canvas2, x, y)
}

function getHitBox(obj) {
    if(obj.getHitBox) return obj.getHitBox()
    if(obj.getBoundingClientRect) return obj.getBoundingClientRect()
    const { x, y, width = 0, height = 0 } = obj
    return {
        left: x - width / 2,
        top: y - height / 2,
        width,
        height,
    }
}

function checkHit(obj1, obj2) {
    const { left: l1, top: t1, width: w1, height: h1 } = getHitBox(obj1)
    const { left: l2, top: t2, width: w2, height: h2 } = getHitBox(obj2)
    return l1 < l2 + w2 && l2 < l1 + w1 && t1 < t2 + h2 && t2 < t1 + h1
}


export {
    Group,
    GameAudio,
    addTo,
    urlAbsPath,
    fitTwoToEl,
    newPointer,
    addToLoads,
    newCanvas,
    newCanvasFromSrc,
    cloneCanvas,
    colorizeCanvas,
    addCanvas,
    checkAllLoadsDone,
    checkHit,
}