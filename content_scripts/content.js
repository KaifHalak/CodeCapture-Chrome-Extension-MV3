console.log("Script Injected")

function LOG(){
    console.log(...arguments)
}

var FLAGS = {
    running : false,
    site_not_supported : false
}

var GLOBALS = {
    jcrop : null,
    worker : null
}

InitTesseract()
.catch(function(error){
    FLAGS.site_not_supported = true
})

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {


    switch (message.type) {
    
        case "init":
            sendResponse("recieved");

            if (FLAGS.site_not_supported){
                alert("Site Not Supported :(")
                return
            }
            
            console.log('jcrop',GLOBALS.jcrop)

            if (FLAGS.running){
                FLAGS.running = false
                console.log("cancelled")
                if (GLOBALS.jcrop){
                    GLOBALS.jcrop.destroy()
                }

                return
            }

            main()
            break;
    }

  });



function main(){

    console.log("Running")
    FLAGS.running = true

    let overlay,settings

    overlay = CreateOverlay()

    settings = {
        bgColor:"none",
        shadeColor: "black",
        borderOpacity:1,
        onSelect: function(info){this.destroy(); FLAGS.jcrop = null; StartCropping(info)}
    }

    overlay.Jcrop(settings,function(){GLOBALS.jcrop = this})
    console.log("Before",GLOBALS.jcrop)
}

function CreateOverlay(){
    let overlay = $("<div></div>").addClass("overlay-screenshot-extension");
    $("body").append(overlay);
    return overlay
}

async function StartCropping(info){
    console.log("After",GLOBALS.jcrop)
    let viewport_screenshot = await GetViewportScreenshot()
    
    if(!viewport_screenshot){
        alert("Error, please try again.")
        return
    }
    // console.log(viewport_screenshot)
    let h,w,x,y,scale

    scale = window.devicePixelRatio

    h = info.h * scale
    w = info.w * scale
    x = info.x * scale
    y = info.y * scale

    let canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    let context = canvas.getContext("2d")

    let img = new Image()
    img.src = viewport_screenshot

    img.onload = async function(){ 
        context.drawImage(img,x,y,w,h,0,0,w,h)
        PerformOCR(canvas.toDataURL())
        // let link = document.createElement("a")
        // link.download = "my_image.jpg"
        // link.href = canvas.toDataURL("image/png")
        // document.body.appendChild(link)
        // link.click()   
    }
    

}


function GetViewportScreenshot(){
    return new Promise(function(resolve,reject){

        chrome.runtime.sendMessage({type:"get_viewport_screenshot"},function(response){

            if(!response){return false}
            resolve(response)

        })

    })

}

async function PerformOCR(img){
    let data = await GLOBALS.worker.recognize(img)
    console.log(data.data.text)
}


async function InitTesseract(){
    const worker = await Tesseract.createWorker()
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    GLOBALS.worker = worker
    console.log("Tesseract Init Complete")
}
 