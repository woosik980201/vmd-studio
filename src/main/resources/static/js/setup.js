// Store Setup 화면 동작
// Week 2: [다음]을 누르면 서버에 저장한다.
//   - 새 작업: POST /api/tasks      → 서버가 만든 작업 번호로 영역 지정 화면 이동
//   - 기존 작업: PUT /api/tasks/{id} → 이미지는 새로 고른 것만 교체

const taskId = getQueryParam('taskId'); // 없으면 새 작업

const storeNameInput = document.getElementById('store-name');
const taskNameInput = document.getElementById('task-name');
const storePhotoInput = document.getElementById('store-photo');
const productImageInput = document.getElementById('product-image');
const productNameInput = document.getElementById('product-name');
const productCodeInput = document.getElementById('product-code');
const productColorInput = document.getElementById('product-color');
const vmdMemoInput = document.getElementById('vmd-memo');
const nextButton = document.getElementById('next-button');

// 기존 작업에 이미 저장된 이미지가 있는지 (있으면 다시 고르지 않아도 된다)
const savedImages = { storePhoto: false, productImage: false };

// 저장 요청을 보내는 중인지 (버튼을 여러 번 눌러 중복 저장되는 것을 막는다)
let isSaving = false;

// 새 작업이면 작업명·상태가 아직 없으므로 단계 표시만 나온다
renderHeader({ currentStep: 'SETUP' });

// [다음] 활성 조건 (Wireframe v0.2): 매장 사진 + 실제 상품 이미지 + 상품명 + 품번
// 이미지는 '새로 골랐거나, 이미 서버에 저장되어 있으면' 충족으로 본다
function updateNextButton() {
    const hasStorePhoto = storePhotoInput.files.length > 0 || savedImages.storePhoto;
    const hasProductImage = productImageInput.files.length > 0 || savedImages.productImage;

    const isReady =
        hasStorePhoto &&
        hasProductImage &&
        productNameInput.value.trim() !== '' &&
        productCodeInput.value.trim() !== '';

    nextButton.disabled = !isReady || isSaving;
}

// 파일을 고르면 같은 자리에 미리보기를 보여준다 (저장은 [다음]을 누를 때)
function connectImagePreview(fileInput, previewArea) {
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (file) {
            showImage(previewArea, URL.createObjectURL(file), '선택한 이미지 미리보기');
        }
        updateNextButton();
    });
}

connectImagePreview(storePhotoInput, document.getElementById('store-photo-preview'));
connectImagePreview(productImageInput, document.getElementById('product-image-preview'));

productNameInput.addEventListener('input', updateNextButton);
productCodeInput.addEventListener('input', updateNextButton);

// 화면의 입력값을 서버로 보낼 FormData로 만든다
// 글자와 파일을 한 번에 보내기 위해 JSON이 아니라 multipart/form-data를 쓴다
// (이름은 서버의 SetupForm, @RequestParam 이름과 같아야 한다)
function buildFormData() {
    const formData = new FormData();
    formData.append('storeName', storeNameInput.value);
    formData.append('name', taskNameInput.value);
    formData.append('productName', productNameInput.value);
    formData.append('productCode', productCodeInput.value);
    formData.append('productColor', productColorInput.value);
    formData.append('vmdMemo', vmdMemoInput.value);

    if (storePhotoInput.files.length > 0) {
        formData.append('storePhoto', storePhotoInput.files[0]);
    }
    if (productImageInput.files.length > 0) {
        formData.append('productImage', productImageInput.files[0]);
    }
    return formData;
}

nextButton.addEventListener('click', async () => {
    isSaving = true;
    nextButton.textContent = '저장 중...';
    updateNextButton();

    try {
        // Content-Type은 직접 정하지 않는다. FormData를 넣으면 브라우저가 알맞게 정해 준다
        const savedTask = await apiRequest(taskId ? `/api/tasks/${taskId}` : '/api/tasks', {
            method: taskId ? 'PUT' : 'POST',
            body: buildFormData()
        });
        window.location.href = `/editor.html?taskId=${savedTask.id}`;
    } catch (error) {
        showError(error);
        isSaving = false;
        nextButton.textContent = '다음: 영역 지정 →';
        updateNextButton();
    }
});

// 기존 작업이면 서버 데이터로 입력 칸과 저장된 이미지를 채운다
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

    showImage(document.getElementById('store-photo-preview'), task.storePhotoUrl, '저장된 매장 사진');
    showImage(document.getElementById('product-image-preview'), task.product.imageUrl, '저장된 상품 이미지');
    savedImages.storePhoto = Boolean(task.storePhotoUrl);
    savedImages.productImage = Boolean(task.product.imageUrl);

    updateNextButton();
}

updateNextButton();

if (taskId) {
    loadExistingTask().catch(showError);
}
