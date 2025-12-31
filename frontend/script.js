document.getElementById("resumeForm").addEventListener("submit", function (e) {
    e.preventDefault();

    document.getElementById("result").classList.remove("hidden");
    document.getElementById("score").innerText = "78%";

    const keywords = ["AWS", "MongoDB", "REST API"];
    const list = document.getElementById("keywords");
    list.innerHTML = "";

    keywords.forEach(keyword => {
        const li = document.createElement("li");
        li.innerText = keyword;
        list.appendChild(li);
    });
});
