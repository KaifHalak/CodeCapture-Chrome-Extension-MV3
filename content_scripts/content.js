
var FLAGS = {
    jcrop : null,
    running : false,
    site_not_supported : false,
    workers_init : false
}

var GLOBALS = {
    all_workers : [],
    all_promises : [], // used to store promises when 1- Init workers 2- When performing OCR
    all_images_ocr : [],// used to store the OCR results
    total_reattempts : 2,
    loading_workers_percentage_completion : 0
}


var UI = {
    progress_bar_window : null,
    progress_bar : null,
    percentage_completion_text : null,
    loading_bar_title : null,
}

InitTesseract()


chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {

    switch (message.type) {
    
        case "init":
            sendResponse("recieved");

            if (FLAGS.site_not_supported){
                CreateTextNotification("Site Not Supported :( ")
                return
            }

            if (!FLAGS.workers_init){ //Dont do anything till the workers initialize
                return
            }

            if (FLAGS.jcrop){  // Remove selection tool if user clicks the icon a second time
                FLAGS.jcrop.destroy()
                FLAGS.jcrop = null

                chrome.runtime.sendMessage({
                    type: "deactivate_icon"
                })

                return
            }

            if (FLAGS.running){
                CreateTextNotification("Please Wait")
            }

            try {
                main()   
            } catch (error) {
                CreateTextNotification("Something Went Wrong! Please Try Again!")
                FLAGS.running = false
                FLAGS.jcrop.destroy()
                FLAGS.jcrop = null
                GLOBALS.all_images_ocr = []
                GLOBALS.all_promises = []

                chrome.runtime.sendMessage({
                    type: "deactivate_icon"
                })

            }
            break;
    

        }



  });


// Start

function main(){

    chrome.runtime.sendMessage({
        type: "activate_icon"
    })

    let overlay,settings

    overlay = CreateOverlay()

    settings = {
        bgColor:"none",
        onSelect: function(info){
            this.destroy(); 
            FLAGS.jcrop = null; 
            StartCropping(info)
        
            chrome.runtime.sendMessage({
                type: "deactivate_icon"
            })
        }
    }
    overlay.Jcrop(settings,function(){FLAGS.jcrop = this})
}

function CreateOverlay(){
    let overlay = $("<div></div>").addClass("overlay-screenshot-extension");
    $("body").append(overlay);
    return overlay
}

async function StartCropping(info){
    try {
        FLAGS.running = true
    CreateTextNotification("Processing...")

    let viewport_screenshot = await GetViewportScreenshot()
    
    let h,w,x,y,scale

    scale = window.devicePixelRatio

    h = info.h * scale
    w = info.w * scale
    x = info.x * scale
    y = info.y * scale

    let canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h

    let img = new Image()
    img.src = viewport_screenshot

    img.onload = async function(){ 
        EditImage(canvas,[img,x,y,w,h,0,0,w,h])
        await Promise.all(GLOBALS.all_promises)
        FindHighestConfidenceResult(canvas.toDataURL())
        GLOBALS.all_promises = []
        FLAGS.running = false
    }
    } catch (error) {
        CreateTextNotification("Something Went Wrong! Please Try Again!")
        FLAGS.running = false
        FLAGS.jcrop.destroy()
        FLAGS.jcrop = null
        GLOBALS.all_images_ocr = []
        GLOBALS.all_promises = []

        chrome.runtime.sendMessage({
            type: "deactivate_icon"
        })

    }
    
}


function GetViewportScreenshot(){
    return new Promise(function(resolve,reject){

        chrome.runtime.sendMessage({type:"get_viewport_screenshot"},function(response){

            if(!response){reject()}
            resolve(response)

        })

    })

}
 


// Tesseract

async function InitTesseract(){
    let current_attempt = 1
    LoadWorkersCompletionUI()

    while (current_attempt <= GLOBALS.total_reattempts){

        try {
            await CreateWorkers()
            await Promise.all(GLOBALS.all_promises)
            FLAGS.workers_init = true
            GLOBALS.all_promises = []
            HideLoadingBarWindow()
            main()
            return
        } catch (error) {
            UpdateLoadWorkersCompletionUIPercentage("0%")
            GLOBALS.loading_workers_percentage_completion = 0
            // setTimeout(function(){UpdateLoadWorkersCompletionUITitle("Re-attempting")},1000)
            GLOBALS.all_promises = []
            GLOBALS.all_workers = []
            current_attempt++
        }

    }
    FLAGS.site_not_supported = true
    HideLoadingBarWindow()
    CreateTextNotification("Site Not Supported :( ")
    // setTimeout(function(){HideLoadingBarWindow()},2000)
    // setTimeout(function(){CreateTextNotification("Site Not Supported :( ")},2500)

}

async function CreateWorkers(){
    let worker
    for (let i = 0; i < 4; i++){
        worker = await Tesseract.createWorker()
        GLOBALS.all_workers.push(worker)
        let workerPromise = InitWorker(worker)
        GLOBALS.all_promises.push(workerPromise)
    }
}

async function InitWorker(worker){
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    GLOBALS.loading_workers_percentage_completion++
    UpdateLoadWorkersCompletionUIPercentage((GLOBALS.loading_workers_percentage_completion / 4)*100 + "%")
}

async function PerformOCR(worker_index,img_url){
    let ocr_promise = GLOBALS.all_workers[worker_index].recognize(img_url)
    GLOBALS.all_promises.push(ocr_promise)
    let ocr_result = await ocr_promise
    GLOBALS.all_images_ocr.push(ocr_result)
}

function FindHighestConfidenceResult(img){
    let highest_confidence = 0
    let highest_confidence_result

    for (let each_result of GLOBALS.all_images_ocr){

        if (each_result.data.confidence > highest_confidence){
            highest_confidence = each_result.data.confidence
            highest_confidence_result = each_result
        }

    }

    if (highest_confidence === 0){
        CreateTextNotification("Error! Please Select A Region")
        return
    }

    //Data to be used by sidebysideUI\script.js
    chrome.storage.local.set({
        img: img,
        confidence: highest_confidence,
        text: highest_confidence_result.data.text
    })

    CreateOCRResultNotification(img,highest_confidence,highest_confidence_result.data.text)
    GLOBALS.all_images_ocr = []

    navigator.clipboard.writeText(highest_confidence_result.data.text)

}


// Img Manipulation


function EditImage(canvas,img_info){
    // Performing OCR on four different images and utilizing the result with the highest confidence level.
    let context, canvas_copy, worker_index
    for (let i = 0; i < 4; i++){
        switch (i){

            case 0:
                worker_index = i
                context = canvas.getContext("2d")
                context.drawImage(...img_info)
                // DonwloadImg(canvas.toDataURL())
                PerformOCR(worker_index,canvas.toDataURL())
                break
            
            case 1:
                worker_index = i
                canvas_copy = canvas.cloneNode(true)
                context = canvas_copy.getContext("2d")
                context.drawImage(...img_info)
                IncreaseContrastCode(context,0.1)
                // DonwloadImg(canvas_copy.toDataURL())
                PerformOCR(worker_index,canvas_copy.toDataURL())
                break

            case 2:
                worker_index = i
                canvas_copy = canvas.cloneNode(true)
                context = canvas_copy.getContext("2d")
                context.drawImage(...img_info)
                IncreaseBrightnessCode(context,40)
                // DonwloadImg(canvas_copy.toDataURL())
                PerformOCR(worker_index,canvas_copy.toDataURL())
                break

            case 3:
                worker_index = i
                canvas_copy = canvas.cloneNode(true)
                context = canvas_copy.getContext("2d")
                context.drawImage(...img_info)
                IncreaseBrightnessCode(context,40)
                IncreaseContrastCode(context,0.1)
                // DonwloadImg(canvas_copy.toDataURL())
                PerformOCR(worker_index,canvas_copy.toDataURL())
                break

        }

    }

}

function IncreaseContrastCode(ctx, contrastFactor) {
  // Get the image data from the canvas
  const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const data = imageData.data;

  // Apply contrast adjustment to each pixel
  for (let i = 0; i < data.length; i += 4) {
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];

    // Calculate the average color intensity (brightness) of the pixel
    const brightness = (red + green + blue) / 3;

    // Calculate the new color values using the contrast factor
    const newRed = (contrastFactor * (red - brightness)) + brightness;
    const newGreen = (contrastFactor * (green - brightness)) + brightness;
    const newBlue = (contrastFactor * (blue - brightness)) + brightness;

    // Update the pixel color values with the adjusted values
    data[i] = newRed;
    data[i + 1] = newGreen;
    data[i + 2] = newBlue;
  }

  // Put the modified image data back onto the canvas
  ctx.putImageData(imageData, 0, 0);
}

function IncreaseBrightnessCode(ctx, brightnessFactor) {
  // Get the image data from the canvas
  const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const data = imageData.data;

  // Apply brightness adjustment to each pixel
  for (let i = 0; i < data.length; i += 4) {
    // Adjust each color channel by adding the brightness factor
    data[i] += brightnessFactor;       // Red
    data[i + 1] += brightnessFactor;   // Green
    data[i + 2] += brightnessFactor;   // Blue
  }

  // Put the modified image data back onto the canvas
  ctx.putImageData(imageData, 0, 0);
}


// Debug

function DonwloadImg(img){
        let link = document.createElement("a")
        link.download = "my_image.jpg"
        link.href = img
        document.body.appendChild(link)
        link.click()  
}



// Notifications

function CreateTextNotification(msg){
    chrome.runtime.sendMessage({type:"create_text_noti",msg:msg})
}

async function CreateOCRResultNotification(img,confidence,text){
    chrome.runtime.sendMessage({
        type:"create_ocr_result_noti",
        confidence: confidence,
        img: img,
        text: text
    })
}


// Loading Bar UI when init tesseract workers

function LoadWorkersCompletionUI(){
    let progress_bar_window = document.createElement("div")
    progress_bar_window.classList.add("progress-bar-window")

    let text_container = document.createElement("div")
    text_container.classList.add("text-container")    
    text_container.innerHTML = `
    <span class="loading-bar-title">Loading Workers</span>
    <span class="percentage-completion">0%</span>
    `   

    let progress_bar_container = document.createElement("div")
    progress_bar_container.classList.add("progress-bar-container")

    let progress_bar = document.createElement("div")
    progress_bar.classList.add("progress-bar")


    progress_bar_container.appendChild(progress_bar)

    progress_bar_window.appendChild(text_container)
    progress_bar_window.appendChild(progress_bar_container)

    // For future use

    UI.progress_bar_window = progress_bar_window
    UI.percentage_completion_text = text_container.querySelector(".percentage-completion")
    UI.loading_bar_title = text_container.querySelector(".loading-bar-title")
    UI.progress_bar = progress_bar

    document.body.appendChild(progress_bar_window) || document.head.appendChild(progress_bar_window)
}

function UpdateLoadWorkersCompletionUIPercentage(value){
    UI.percentage_completion_text.innerText = value
    UI.progress_bar.style.width = value
}

function UpdateLoadWorkersCompletionUITitle(title){
    UI.loading_bar_title.innerText = title
}

function HideLoadingBarWindow(){
    UI.progress_bar_window.hidden = 1
}



