/**
 * Keycloak 초기 가입 및 로그인 환경 설정을 위한 자동화 스크립트 (V3 - 일반 가입 방식으로 복구)
 * 
 * 주요 변경 사항:
 * 1. 이메일 인증 비활성화 (SMTP 설정 없이도 가입 가능)
 * 2. 도메인(@maymust.com) 제한 제거
 * 3. 일반적인 아이디(Username) 기반 회원가입 허용
 */

const setup = async () => {
    try {
        const realmName = "dashboard-realm";

        console.log('1. 관리자 토큰 획득 중...');
        const tokenRes = await fetch("http://localhost:8080/realms/master/protocol/openid-connect/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ username: "admin", password: "admin", grant_type: "password", client_id: "admin-cli" })
        });
        const token = (await tokenRes.json()).access_token;

        console.log(`2. 렐름(${realmName}) 설정 복구 중...`);
        const currentRealmRes = await fetch(`http://localhost:8080/admin/realms/${realmName}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        let realmConfig = await currentRealmRes.json();

        // 설정 복구
        realmConfig.registrationAllowed = true;
        realmConfig.registrationEmailAsUsername = false; // 일반 아이디 가입 허용
        realmConfig.verifyEmail = false;                 // [중요] 이메일 인증 끔 (SMTP 불필요)
        realmConfig.resetPasswordAllowed = true;
        
        // 기본 서비스에 이메일 인증이 포함되지 않도록 설정
        if (realmConfig.defaultRequiredActions) {
            realmConfig.defaultRequiredActions = realmConfig.defaultRequiredActions.filter(action => action !== 'VERIFY_EMAIL');
            console.log('기본 필수 작업에서 이메일 인증을 제거했습니다.');
        }
        
        await fetch(`http://localhost:8080/admin/realms/${realmName}`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(realmConfig)
        });

        console.log('3. 유저 프로필(User Profile) 제한 제거 중...');
        const profileRes = await fetch(`http://localhost:8080/admin/realms/${realmName}/users/profile`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const profileConfig = await profileRes.json();
        const emailAttr = profileConfig.attributes.find(a => a.name === 'email');
        
        if (emailAttr && emailAttr.validations && emailAttr.validations.pattern) {
            // 이메일 패턴 검증기(도메인 제한) 제거
            delete emailAttr.validations.pattern;
            
            await fetch(`http://localhost:8080/admin/realms/${realmName}/users/profile`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(profileConfig)
            });
            console.log('메일 도메인 제한이 제거되었습니다.');
        }

        console.log('4. testuser 계정 인증 상태 강제 업데이트 중...');
        const usersRes = await fetch(`http://localhost:8080/admin/realms/${realmName}/users?username=testuser`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const users = await usersRes.json();
        const testuser = users.find(u => u.username === 'testuser');

        if (testuser) {
            console.log(`- testuser(ID: ${testuser.id})를 찾았습니다. 설정을 변경합니다...`);
            
            // 이메일 인증 완료 처리 및 필수 작업 제거
            testuser.emailVerified = true;
            testuser.requiredActions = (testuser.requiredActions || []).filter(action => action !== 'VERIFY_EMAIL');

            const updateUserRes = await fetch(`http://localhost:8080/admin/realms/${realmName}/users/${testuser.id}`, {
                method: "PUT",
                headers: { 
                    "Authorization": `Bearer ${token}`, 
                    "Content-Type": "application/json" 
                },
                body: JSON.stringify(testuser)
            });

            if (updateUserRes.ok) {
                console.log('✅ testuser 계정의 이메일 인증이 완료되었고 필수 작업이 제거되었습니다.');
            } else {
                console.error('❌ testuser 업데이트 실패:', await updateUserRes.text());
            }
        } else {
            console.log('testuser 계정을 찾을 수 없습니다. (이미 삭제되었거나 생성되지 않음)');
        }

        console.log('\n✅ V3 설정 완료! (표준 가입 방식으로 복원됨)');
        console.log('- 이제 이메일 인증 없이 바로 회원가입이 가능합니다.');
        console.log('- testuser 계정도 인증 없이 바로 로그인이 가능할 것입니다.');
        console.log('- 모든 메일 도메인으로 가입할 수 있습니다.');
    } catch (e) {
        console.error('설정 실패:', e);
    }
};

setup();
