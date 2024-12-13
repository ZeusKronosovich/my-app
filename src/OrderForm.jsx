import React, { useState, useEffect } from 'react';

const OrderForm = ({ onShowOrders }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [volume, setVolume] = useState('');
    const [concreteGrade, setConcreteGrade] = useState('M50');
    const [deliveryDate, setDeliveryDate] = useState('');
    const [address, setAddress] = useState('');
    const [price, setPrice] = useState(0);

    const prices = {
        M50: 2500,
        M100: 3000,
        M150: 3500,
        M200: 4000,
        M250: 4500,
        M300: 5000,
        M350: 5500,
        M400: 6000,
        M450: 6500,
        M500: 7000,
    };

    const calculatePrice = () => {
        if (volume) {
            const pricePerCubicMeter = prices[concreteGrade];
            setPrice(pricePerCubicMeter * volume);
        } else {
            setPrice(0);
        }
    };

    useEffect(() => {
        calculatePrice();
    }, [volume, concreteGrade]);

    const handleOrderClick = () => {
        setIsOpen(!isOpen);
    };

    const isAddressValid = (address) => {
        const regex = /^[a-zA-Zа-яА-Я0-9.,/ ]+$/;
        return regex.test(address);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');

        const currentDate = new Date();
        const inputDate = new Date(deliveryDate);
        if (inputDate < currentDate) {
            alert("Дата доставки не может быть раньше текущей даты.");
            return;
        }

        if (!isAddressValid(address)) {
            alert("Адрес доставки должен содержать только буквы, цифры и символы: '.', ',', '/'");
            return;
        }

        const parsedVolume = parseFloat(volume);
        if (parsedVolume <= 0) {
            alert("Невозможно сделать заказ. Указан некорректный объём заказываемого товара");
            return;
        }

        try {
            const response = await fetch('http://localhost:8081/orders/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`, 
                },
                body: JSON.stringify({
                    o_betonv: parsedVolume,
                    o_betonmark: concreteGrade,
                    o_betontarget: address,
                    o_betontime: deliveryDate,
                    o_price: Math.floor(price),
                }),
            });

            if (response.ok) {
                console.log('Заказ успешно отправлен');
                setIsOpen(false);
                onShowOrders();
            } else {
                const errorData = await response.json();
                console.error('Ошибка при отправке заказа:', errorData);
            }
        } catch (error) {
            console.error('Ошибка при запросе:', error);
        }
    };

    return (
        <div>
            <button onClick={handleOrderClick} className="order-button">Заказать бетон</button>
            {isOpen && (
                <form onSubmit={handleSubmit} className="order-form"> 
                    <label>
                        Объем (м³):
                        <input 
                            type="text" 
                            value={volume} 
                            onChange={(e) => setVolume(e.target.value)}
                            placeholder="Объем" 
                            required 
                        />
                    </label>
                    <label>
                        Марка бетона:
                        <select value={concreteGrade} onChange={(e) => setConcreteGrade(e.target.value)}>
                            {Object.keys(prices).map((grade) => (
                                <option key={grade} value={grade}>{grade}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Адрес доставки:
                        <input 
                            type="text" 
                            value={address} 
                            onChange={(e) => setAddress(e.target.value)} 
                            placeholder="Адрес доставки" 
                            required 
                        />
                    </label>
                    <label>
                        Дата доставки (ДД.ММ.ГГГГ):
                        <input 
                            type="date" 
                            value={deliveryDate} 
                            onChange={(e) => setDeliveryDate(e.target.value)} 
                            required 
                            min={new Date().toISOString().split("T")[0]} // Проверка на соответствие даты
                        />
                    </label>
                    <div>
                        <strong>Цена: {price} руб.</strong> 
                    </div>
                    <button type="submit">Отправить заказ</button>
                </form>
            )}
        </div>
    );
};

export default OrderForm;