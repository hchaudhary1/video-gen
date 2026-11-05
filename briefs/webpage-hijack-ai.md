# How a Webpage Can Hijack Your AI Assistant

Create a 5–7 minute technical explainer, targeting 360 seconds, landscape 16:9.

Opening hook, preserve exactly: “You ask your AI to summarise an email. The email tells your AI to betray you. Whose instructions does it follow?”

Explain indirect prompt injection: an assistant reads untrusted webpage or email content, treats malicious instructions inside it as authority, and is steered away from the user's task. Explain possibility and failure conditions, not inevitable compromise.

Story: an assistant helps plan a trip and reads a malicious hotel page. Clearly label the entire example FICTIONAL EXAMPLE on screen and identify it in narration. Follow an attacker-origin instruction trying to redirect the trip-planning task. Any sensitive data, accounts, addresses, websites and transactions must be fictional. Do not claim a real exploit was executed. Keep attack text conceptual and brief.

Structure: hook; travel setup; the mechanism of crossing the boundary between content and instructions; consequences when assistants can access accounts and tools; layered defenses; return to who controls the next action. Distinguish reading content from authority to act. No claim that a prompt alone, a classifier, or a confirmation makes agents immune.

Central visual device: the assistant carries the user's task on a BLUE instruction card. A webpage slips a RED attacker card into the stack. Animate which card controls the assistant's next action, showing the wrong turn and later interception by defense layers. Colors signal provenance and authority, not a literal model architecture. Build a continuous moving story using original drawings rather than title/text slides.

Defenses: restricted permissions and scope, checks on proposed actions, user confirmations for consequential steps. Attribute Chrome's published design specifically: User Alignment Critic isolated from raw untrusted page content; origin gating; critical-step confirmations. Distinguish the described broader origin-set design from the initially implemented simpler read-writable gating. Explain limits honestly. Retain dated evidence; avoid unsourced claims about current deployment.

Required primary sources:
- https://www.anthropic.com/research/prompt-injection-defenses (published November 24, 2025)
- https://blog.google/security/architecting-security-for-agentic/ (published December 8, 2025)

Research these pages and retain local evidence and claim provenance. Further primary sources may support explanations. No invented firsthand testing, listening, or outcomes. The author may say they read the sources only after actually reading them.

Thumbnail direction: a browser page whispering into a robot's ear. Heavy text exactly: “WHO’S IN CONTROL?” Match video canvas and use actual loaded ExtraBold/Black fonts at natural proportions. The red card/browser and blue task should echo the film's visual story. Produce one strong thumbnail variant.

Title: How a Webpage Can Hijack Your AI Assistant

User requested video creation. Use the repository's normal independent reviews and publication-copy approval policy. Do not send Discord notifications.
