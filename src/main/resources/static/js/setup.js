// Store Setup 화면 동작
// Week 2: 기존 작업이면 서버에서 받아와 입력 칸을 채운다. 서버 저장은 다음 단계에서 추가한다.

const taskId = getQueryParam('taskId'); // 없으면 새 작업

const storeNameInput = document.getElementById('store-name');
const taskNameInput = document.getElementById('task-name');
const storePhotoInput = document.getElementById('store-photo');
const productImageInput = document.getElementById('product-image');
const productNameInput = document.getElementById('product-name');
const productCodeInput = document.getElementById('product-code');
const productColorInput = document.getElementById('product-color');
const nextButton = document.getElementById('next-button');

const vmdMemoInput = document.getElementById('vmd-memo');

// 새 작업이면 작업명·상태가 아직 없으므로 단계 표시만 나온다
renderHeader({ currentStep: 'SETUP' });

// 기존 작업이면 서버 데이터로 글자 입력 칸을 채운다 (이미지는 다시 선택해야 함)
async function loadExistingTask() {
    const task = await fetchTask(taskId);

    renderHeader({
        taskName: task.name,
        storeName: task.storeName,
        status: task.status,
        currentStep: 'SETUP'
    });

    storeNameInput.value = task.storeName;
    taskNameInput.value = task.name;
    productNameInput.value = task.product.name;
    productCodeInput.value = task.product.code;
    productColorInput.value = task.product.color || '';
    vmdMemoInput.value = task.product.memo || '';
    updateNextButton();
}

// [다음] 활성 조건 (Wireframe v0.2): 매장 사진 + 실제 상품 이미지 + 상품명 + 품번
function updateNextButton() {
    const isReady =
        storePhotoInput.files.length > 0 &&
        productImageInput.files.length > 0 &&
        productNameInput.value.trim() !== '' &&
        productCodeInput.value.trim() !== '';

    nextButton.disabled = !isReady;
}

// 파일을 고르면 같은 자리에 미리보기를 보여준다 (서버로 보내지 않음)
function connectImagePreview(fileInput, previewArea) {
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (file) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.alt = '선택한 이미지 미리보기';
            previewArea.innerHTML = '';
            previewArea.appendChild(img);
        }
        updateNextButton();
    });
}

connectImagePreview(storePhotoInput, document.getElementById('store-photo-preview'));
connectImagePreview(productImageInput, document.getElementById('product-image-preview'));

productNameInput.addEventListener('input', updateNextButton);
productCodeInput.addEventListener('input', updateNextButton);

nextButton.addEventListener('click', () => {
    // Week 1 골격: 아직 서버에 저장하지 않는다.
    // API를 연결하면 여기서 POST /api/tasks로 저장하고, 서버가 준 taskId로 이동한다.
    const nextTaskId = taskId || 1;
    window.location.href = `/editor.html?taskId=${nextTaskId}`;
});

updateNextButton();

if (taskId) {
    loadExistingTask().catch(showError);
}
