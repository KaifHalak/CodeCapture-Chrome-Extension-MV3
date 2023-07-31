const UI = {
    slider : document.querySelector(".slider"),
    img : document.querySelector(".img-container img"),
    text_area : document.querySelector(".text-area"),
    confidence_text: document.querySelector(".confidence-text")
}


chrome.storage.local.get(null,function(data){
    UI.img.src = data.img
    UI.text_area.innerHTML = `${data.text}`
    UI.confidence_text.innerText = data.confidence
})


let previous_value = 50
let factor = 12

UI.slider.addEventListener("input",function(){
    let current_value = parseInt(UI.slider.value)

    if (current_value > previous_value){
        UI.img.width = UI.img.width + Math.abs(previous_value - current_value) * factor
    } else {
        UI.img.width = UI.img.width - Math.abs(previous_value - current_value) * factor
    }

    previous_value = current_value

})