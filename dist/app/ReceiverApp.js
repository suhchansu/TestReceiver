import { ReceiverPlayer } from "../player/ReceiverPlayer.js";
export class ReceiverApp {
    player = new ReceiverPlayer();
    start() {
        const boot = () => {
            this.player.init();
            this.player.start();
            console.log("[ReceiverApp] started");
        };
        if (document.readyState === "complete" || document.readyState === "interactive") {
            boot();
        }
        else {
            window.addEventListener("DOMContentLoaded", boot);
        }
    }
}
// Auto start
new ReceiverApp().start();
//# sourceMappingURL=ReceiverApp.js.map