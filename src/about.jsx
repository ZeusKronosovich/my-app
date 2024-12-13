import React, { useState} from 'react';

const Abouts = () => {
    const [isOpen, setIsOpen] = useState(false);
    const handlePClick = () => {
        setIsOpen(!isOpen);
    };
    return (
        <div className='Abouts'>
            <button onClick={handlePClick} className="order-button">О нашей компании</button>
            {isOpen && (
                <form className="order-form">
                    <label>
                <div>Наша компания уже более десяти лет на рынке. Проверенное годами качество.</div>
                <div>Контактный номер: <i>+7 (999) 000-00-00</i></div>
                <div>Контактный e-mail: <b>BETONTRADE@MAIL.RU</b></div>
                    </label>
                    <label><i>Нажмите на кнопку <b>О нашей компании</b>, чтобы скрыть эту информацию</i></label>
                </form>
            )}
        </div>
    );
};

export default Abouts;