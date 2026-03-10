<#import "footer.ftl" as loginFooter>
<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<!DOCTYPE html>
<html class="${properties.kcHtmlClass!}" lang="${lang}"<#if realm.internationalizationEnabled> dir="${(locale.rtl)?then('rtl','ltr')}"</#if>>

<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />

    <#if properties.meta?has_content>
        <#list properties.meta?split(' ') as meta>
            <meta name="${meta?split('==')[0]}" content="${meta?split('==')[1]}"/>
        </#list>
    </#if>
    <title>${msg("loginTitle",(realm.displayName!''))}</title>
    <link rel="icon" href="${url.resourcesPath}/img/favicon.ico" />
    <#if properties.stylesCommon?has_content>
        <#list properties.stylesCommon?split(' ') as style>
            <link href="${url.resourcesCommonPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <#if properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <#if properties.scripts?has_content>
        <#list properties.scripts?split(' ') as script>
            <script src="${url.resourcesPath}/${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <script type="importmap">
        {
            "imports": {
                "rfc4648": "${url.resourcesCommonPath}/vendor/rfc4648/rfc4648.js"
            }
        }
    </script>
    <script src="${url.resourcesPath}/js/menu-button-links.js" type="module"></script>
    <#if scripts??>
        <#list scripts as script>
            <script src="${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <script type="module">
        import { startSessionPolling } from "${url.resourcesPath}/js/authChecker.js";

        startSessionPolling(
            "${url.ssoLoginInOtherTabsUrl?no_esc}"
        );
    </script>
    <script type="module">
        document.addEventListener("click", (event) => {
            const link = event.target.closest("a[data-once-link]");

            if (!link) {
                return;
            }

            if (link.getAttribute("aria-disabled") === "true") {
                event.preventDefault();
                return;
            }

            const { disabledClass } = link.dataset;

            if (disabledClass) {
                link.classList.add(...disabledClass.trim().split(/\s+/));
            }

            link.setAttribute("role", "link");
            link.setAttribute("aria-disabled", "true");
        });
    </script>
    <#if authenticationSession??>
        <script type="module">
            import { checkAuthSession } from "${url.resourcesPath}/js/authChecker.js";

            checkAuthSession(
                "${authenticationSession.authSessionIdHash}"
            );
        </script>
    </#if>
</head>

<body class="${properties.kcBodyClass!}" data-page-id="login-${pageId}">
<div class="split-screen">
  <div class="split-left" id="physics-container">
    <!-- Animated Container Cluster Background -->
    <#-- Generate multiple floating nodes -->
    <#list 1..5 as i>
        <div class="node-block node-${(i % 5) + 1} draggable-node">
            <div class="node-header">
                <span class="node-id">pod-${i?string("00")}</span>
                <#if i % 3 == 0>
                    <span class="node-icon">&#9889;</span>
                <#else>
                    <span class="node-icon">&#9632;</span>
                </#if>
            </div>
            <div class="node-metrics">
                <div class="metric-bar"><div class="metric-fill v-${(i * 17) % 100}"></div></div>
                <div class="metric-bar"><div class="metric-fill v-${(i * 23) % 100}"></div></div>
            </div>
            <!-- Tooltip Content -->
            <div class="node-tooltip">
                <div class="tooltip-header text-bold">pod-${i?string("00")}</div>
                <div class="tooltip-body">
                    <div class="tooltip-row"><span>NS:</span><span>app-worker</span></div>
                    <div class="tooltip-row"><span>Node:</span><span>gpu-node-0${(i%3)+1}</span></div>
                    <div class="tooltip-row"><span>CPU:</span><span>${(i * 17) % 100}%</span></div>
                    <div class="tooltip-row"><span>MEM:</span><span>${(i * 23) % 100}%</span></div>
                </div>
            </div>
        </div>
    </#list>
  </div>
  <div class="split-right">
    <div class="${properties.kcLoginClass!}">
    <div id="kc-header" class="${properties.kcHeaderClass!}">
        <div id="kc-header-wrapper"
             class="${properties.kcHeaderWrapperClass!}">${kcSanitize(msg("loginTitleHtml",(realm.displayNameHtml!'')))?no_esc}</div>
    </div>
    <div class="${properties.kcFormCardClass!}">
        <header class="${properties.kcFormHeaderClass!}">
            <#if realm.internationalizationEnabled  && locale.supported?size gt 1>
                <div class="${properties.kcLocaleMainClass!}" id="kc-locale">
                    <div id="kc-locale-wrapper" class="${properties.kcLocaleWrapperClass!}">
                        <div id="kc-locale-dropdown" class="menu-button-links ${properties.kcLocaleDropDownClass!}">
                            <button tabindex="1" id="kc-current-locale-link" aria-label="${msg("languages")}" aria-haspopup="true" aria-expanded="false" aria-controls="language-switch1">${locale.current}</button>
                            <ul role="menu" tabindex="-1" aria-labelledby="kc-current-locale-link" aria-activedescendant="" id="language-switch1" class="${properties.kcLocaleListClass!}">
                                <#assign i = 1>
                                <#list locale.supported as l>
                                    <li class="${properties.kcLocaleListItemClass!}" role="none">
                                        <a role="menuitem" id="language-${i}" class="${properties.kcLocaleItemClass!}" href="${l.url}">${l.label}</a>
                                    </li>
                                    <#assign i++>
                                </#list>
                            </ul>
                        </div>
                    </div>
                </div>
            </#if>
        <#if !(auth?has_content && auth.showUsername() && !auth.showResetCredentials())>
            <#if displayRequiredFields>
                <div class="${properties.kcContentWrapperClass!}">
                    <div class="${properties.kcLabelWrapperClass!} subtitle">
                        <span class="subtitle"><span class="required">*</span> ${msg("requiredFields")}</span>
                    </div>
                    <div class="col-md-10">
                        <h1 id="kc-page-title"><#nested "header"></h1>
                    </div>
                </div>
            <#else>
                <h1 id="kc-page-title"><#nested "header"></h1>
            </#if>
        <#else>
            <#if displayRequiredFields>
                <div class="${properties.kcContentWrapperClass!}">
                    <div class="${properties.kcLabelWrapperClass!} subtitle">
                        <span class="subtitle"><span class="required">*</span> ${msg("requiredFields")}</span>
                    </div>
                    <div class="col-md-10">
                        <#nested "show-username">
                        <div id="kc-username" class="${properties.kcFormGroupClass!}">
                            <label id="kc-attempted-username">${auth.attemptedUsername}</label>
                            <a id="reset-login" href="${url.loginRestartFlowUrl}" aria-label="${msg("restartLoginTooltip")}">
                                <div class="kc-login-tooltip">
                                    <i class="${properties.kcResetFlowIcon!}"></i>
                                    <span class="kc-tooltip-text">${msg("restartLoginTooltip")}</span>
                                </div>
                            </a>
                        </div>
                    </div>
                </div>
            <#else>
                <#nested "show-username">
                <div id="kc-username" class="${properties.kcFormGroupClass!}">
                    <label id="kc-attempted-username">${auth.attemptedUsername}</label>
                    <a id="reset-login" href="${url.loginRestartFlowUrl}" aria-label="${msg("restartLoginTooltip")}">
                        <div class="kc-login-tooltip">
                            <i class="${properties.kcResetFlowIcon!}"></i>
                            <span class="kc-tooltip-text">${msg("restartLoginTooltip")}</span>
                        </div>
                    </a>
                </div>
            </#if>
        </#if>
      </header>
      <div id="kc-content">
        <div id="kc-content-wrapper">

          <#-- App-initiated actions should not see warning messages about the need to complete the action -->
          <#-- during login.                                                                               -->
          <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
              <div class="alert-${message.type} ${properties.kcAlertClass!} pf-m-<#if message.type = 'error'>danger<#else>${message.type}</#if>">
                  <div class="pf-c-alert__icon">
                      <#if message.type = 'success'><span class="${properties.kcFeedbackSuccessIcon!}"></span></#if>
                      <#if message.type = 'warning'><span class="${properties.kcFeedbackWarningIcon!}"></span></#if>
                      <#if message.type = 'error'><span class="${properties.kcFeedbackErrorIcon!}"></span></#if>
                      <#if message.type = 'info'><span class="${properties.kcFeedbackInfoIcon!}"></span></#if>
                  </div>
                      <span class="${properties.kcAlertTitleClass!}">${kcSanitize(message.summary)?no_esc}</span>
              </div>
          </#if>

          <#nested "form">

          <#if auth?has_content && auth.showTryAnotherWayLink()>
              <form id="kc-select-try-another-way-form" action="${url.loginAction}" method="post">
                  <div class="${properties.kcFormGroupClass!}">
                      <input type="hidden" name="tryAnotherWay" value="on"/>
                      <a href="#" id="try-another-way"
                         onclick="document.forms['kc-select-try-another-way-form'].requestSubmit();return false;">${msg("doTryAnotherWay")}</a>
                  </div>
              </form>
          </#if>

          <#nested "socialProviders">

          <#if displayInfo>
              <div id="kc-info" class="${properties.kcSignUpClass!}">
                  <div id="kc-info-wrapper" class="${properties.kcInfoAreaWrapperClass!}">
                      <#nested "info">
                  </div>
              </div>
          </#if>
        </div>
      </div>
      <@loginFooter.content/>
    </div>
  </div>
</div>
<script>
    document.addEventListener("DOMContentLoaded", function() {
        // Login Fields
        var userField = document.getElementById("username") || document.getElementById("email");
        if (userField && !userField.placeholder) {
            userField.placeholder = "id 입력하세요";
        }
        var passField = document.getElementById("password");
        if (passField && !passField.placeholder) {
            passField.placeholder = "password 입력하세요";
        }

        // Registration Fields
        var emailField = document.getElementById("email");
        if (emailField && !emailField.placeholder) {
            emailField.placeholder = "이메일을 입력하세요";
        }
        var firstNameField = document.getElementById("firstName");
        if (firstNameField && !firstNameField.placeholder) {
            firstNameField.placeholder = "이름을 입력하세요";
        }
        var lastNameField = document.getElementById("lastName");
        if (lastNameField && !lastNameField.placeholder) {
            lastNameField.placeholder = "성을 입력하세요";
        }
        var passConfirmField = document.getElementById("password-confirm");
        if (passConfirmField && !passConfirmField.placeholder) {
            passConfirmField.placeholder = "비밀번호를 다시 입력하세요";
        }

        // --- Physics Engine & Drag Logic ---
        <#noparse>
        const container = document.getElementById('physics-container');
        if(!container) return;
        const nodes = document.querySelectorAll('.draggable-node');
        
        let containerRect = container.getBoundingClientRect();
        window.addEventListener('resize', () => { containerRect = container.getBoundingClientRect(); });

        const physicsNodes = [];

        nodes.forEach((node, index) => {
            // Random start pos within container padding
            const padding = 50;
            const x = padding + Math.random() * (containerRect.width - 150 - padding * 2);
            const y = padding + Math.random() * (containerRect.height - 150 - padding * 2);
            // Initial velocity is zero; stationary until interacted with
            const vx = 0;
            const vy = 0;

            node.style.left = `${x}px`;
            node.style.top = `${y}px`;

            const physNode = {
                el: node,
                x: x,
                y: y,
                vx: vx,
                vy: vy,
                width: 100, // Matching CSS width (.node-block)
                height: 100, // Slightly taller sometimes but 100 is solid baseline
                isDragging: false,
                isHovered: false
            };

            // Calculate exact height dynamically for multi-size nodes
            setTimeout(() => {
                 physNode.width = node.offsetWidth;
                 physNode.height = node.offsetHeight;
            }, 100);

            physicsNodes.push(physNode);

            // -- Hover Pause --
            node.addEventListener('mouseenter', () => physNode.isHovered = true);
            node.addEventListener('mouseleave', () => physNode.isHovered = false);

            // -- Dragging Logic --
            let startMouseX = 0, startMouseY = 0;
            let startNodeX = 0, startNodeY = 0;
            let lastMouseX = 0, lastMouseY = 0;

            const onMouseMove = (e) => {
                const dx = e.clientX - startMouseX;
                const dy = e.clientY - startMouseY;
                physNode.x = startNodeX + dx;
                physNode.y = startNodeY + dy;
                
                // Track mouse velocity to "throw" it
                physNode.vx = (e.clientX - lastMouseX);
                physNode.vy = (e.clientY - lastMouseY);
                
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;

                // constrain slightly so we don't lose it off-screen during drag
                if(physNode.x < 0) physNode.x = 0;
                if(physNode.y < 0) physNode.y = 0;
                if(physNode.x + physNode.width > containerRect.width) physNode.x = containerRect.width - physNode.width;
                if(physNode.y + physNode.height > containerRect.height) physNode.y = containerRect.height - physNode.height;

                node.style.left = `${physNode.x}px`;
                node.style.top = `${physNode.y}px`;
            };

            const onMouseUp = () => {
                physNode.isDragging = false;
                node.style.cursor = 'grab';
                node.style.zIndex = '1'; // Return to normal layer
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            node.addEventListener('mousedown', (e) => {
                physNode.isDragging = true;
                node.style.cursor = 'grabbing';
                node.style.zIndex = '100'; // Bring to front while dragging
                
                startMouseX = e.clientX;
                startMouseY = e.clientY;
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
                startNodeX = physNode.x;
                startNodeY = physNode.y;

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });

        // -- Main Animation Loop --
        function updatePhysics() {
            physicsNodes.forEach(p => {
                if (p.isDragging) return; // Skip physics if user is holding it
                if (p.isHovered) {
                    // Slow down gracefully when hovered
                    p.vx *= 0.9;
                    p.vy *= 0.9;
                }

                p.x += p.vx;
                p.y += p.vy;

                // Damping for thrown nodes so they settle back to normal speed
                const maxSpeed = 0.6; // Lower max speed to prevent seasickness
                const currentSpeedSq = p.vx*p.vx + p.vy*p.vy;
                if(currentSpeedSq > maxSpeed*maxSpeed) {
                    p.vx *= 0.92;
                    p.vy *= 0.92;
                } else if(!p.isHovered && currentSpeedSq > 0) {
                    // Gradual damping until completely stopped
                    p.vx *= 0.98;
                    p.vy *= 0.98;
                    if(currentSpeedSq < 0.001) {
                        p.vx = 0;
                        p.vy = 0;
                    }
                }

                // Bounce off Left / Right walls with soft dampening
                if (p.x <= 0) {
                    p.x = 0;
                    p.vx = Math.abs(p.vx) * 0.9;
                } else if (p.x + p.width >= containerRect.width) {
                    p.x = containerRect.width - p.width;
                    p.vx = -Math.abs(p.vx) * 0.9;
                }

                // Bounce off Top / Bottom walls with soft dampening
                if (p.y <= 0) {
                    p.y = 0;
                    p.vy = Math.abs(p.vy) * 0.9;
                } else if (p.y + p.height >= containerRect.height) {
                    p.y = containerRect.height - p.height;
                    p.vy = -Math.abs(p.vy) * 0.9;
                }

                p.el.style.left = `${p.x}px`;
                p.el.style.top = `${p.y}px`;
            });

            requestAnimationFrame(updatePhysics);
        }

        requestAnimationFrame(updatePhysics);
        </#noparse>
    });
</script>
</body>
</html>
</#macro>
