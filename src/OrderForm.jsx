import React, { useState, useEffect } from 'react';

const OrderForm = ({ onShowOrders, onFormToggle }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [volume, setVolume] = useState('');
    const [concreteGrade, setConcreteGrade] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');
    const [address, setAddress] = useState('');
    const [price, setPrice] = useState(0);
    const [prices, setPrices] = useState({});
    const [concreteGrades, setConcreteGrades] = useState([]);
    const [isSeller, setIsSeller] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const login = localStorage.getItem('login');
        setIsSeller(login === 'seller');
        fetchConcreteGrades();
        fetchPrices();
    }, []);

    const fetchConcreteGrades = async () => {
        try {
            const response = await fetch('http://localhost:8081/concrete/grades');
            if (response.ok) {
                const data = await response.json();
                const sortedGrades = (data || []).sort((a, b) => {
                    const numA = parseInt(a.replace('M', ''));
                    const numB = parseInt(b.replace('M', ''));
                    return numA - numB;
                });
                setConcreteGrades(sortedGrades);
                if (sortedGrades.length > 0 && !concreteGrade) {
                    setConcreteGrade(sortedGrades[0]);
                }
            }
        } catch (error) {
            console.error('Ошибка при загрузке марок бетона:', error);
        }
    };

    const fetchPrices = async () => {
        try {
            const response = await fetch('http://localhost:8081/prices');
            if (response.ok) {
                const data = await response.json();
                setPrices(data);
            }
        } catch (error) {
            console.error('Ошибка при загрузке цен:', error);
        }
    };

    const calculatePrice = () => {
        if (volume && prices[concreteGrade]) {
            const pricePerCubicMeter = prices[concreteGrade];
            setPrice(pricePerCubicMeter * volume);
        } else {
            setPrice(0);
        }
    };

    useEffect(() => {
        calculatePrice();
    }, [volume, concreteGrade, prices]);

    const handleOrderClick = () => {
        const newState = !isOpen;
        setIsOpen(newState);
        if (onFormToggle) {
            onFormToggle(newState);
        }
    };

    const handleCloseForm = () => {
        setIsOpen(false);
        if (onFormToggle) {
            onFormToggle(false);
        }
    };

    const isAddressValid = (address) => {
        const regex = /^[a-zA-Zа-яА-Я0-9\s.,/\-\–\—]+$/;
        return regex.test(address);
    };

    const handleAddressChange = (e) => {
        const value = e.target.value;
        if (value.length <= 120 && isAddressValid(value)) {
            setAddress(value);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (isSubmitting) return;
        
        setIsSubmitting(true);
        const token = localStorage.getItem('token');

        const parsedVolume = parseFloat(volume);
        if (!parsedVolume || parsedVolume <= 0) {
            alert("Пожалуйста, введите корректный объем бетона");
            setIsSubmitting(false);
            return;
        }

        const currentDate = new Date();
        const inputDate = new Date(deliveryDate);
        if (inputDate < currentDate.setHours(0,0,0,0)) {
            alert("Дата доставки не может быть раньше текущей даты.");
            setIsSubmitting(false);
            return;
        }

        if (!isAddressValid(address)) {
            alert("Адрес доставки должен содержать только буквы, цифры и разрешенные символы: пробел, '.', ',', '/', '-'");
            setIsSubmitting(false);
            return;
        }

        if (address.length > 120) {
            alert("Адрес доставки не может превышать 120 символов");
            setIsSubmitting(false);
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
                alert('Заказ успешно создан!');
                handleCloseForm();
                // Сброс формы
                setVolume('');
                setAddress('');
                setDeliveryDate('');
            } else {
                const errorText = await response.text();
                console.error('Ошибка при отправке заказа:', errorText);
                alert('Ошибка при создании заказа: ' + errorText);
            }
        } catch (error) {
            console.error('Ошибка при запросе:', error);
            alert('Ошибка сети при создании заказа');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div>
            {isSeller ? (
                <button onClick={handleOrderClick} className="order-button">
                    Панель продавца
                </button>
            ) : (
                <button 
                    onClick={handleOrderClick} 
                    className="order-button"
                >
                    Заказать бетон
                </button>
            )}

            {isOpen && !isSeller && (
                <div className="order-modal-overlay">
                    <div className="order-form-modal">
                        <div className="order-form-header">
                            <h3>Оформление заказа</h3>
                            <button onClick={handleCloseForm} className="close-order-form">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="order-form"> 
                            <div className="form-group">
                                <label>
                                    Объем (м³):
                                    <input 
                                        type="number" 
                                        value={volume} 
                                        onChange={(e) => setVolume(e.target.value)}
                                        placeholder="Введите объем" 
                                        required 
                                        min="0.1"
                                        step="0.1"
                                        disabled={isSubmitting}
                                    />
                                </label>
                            </div>
                            <div className="form-group">
                                <label>
                                    Марка бетона:
                                    <select 
                                        value={concreteGrade} 
                                        onChange={(e) => setConcreteGrade(e.target.value)}
                                        disabled={isSubmitting}
                                    >
                                        {concreteGrades.map((grade) => (
                                            <option key={grade} value={grade}>{grade}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            <div className="form-group">
                                <label>
                                    Адрес доставки ({address.length}/120):
                                    <input 
                                        type="text" 
                                        value={address} 
                                        onChange={handleAddressChange}
                                        placeholder="Введите адрес доставки" 
                                        required 
                                        disabled={isSubmitting}
                                        maxLength={120}
                                    />
                                </label>
                                <small style={{color: '#666', fontSize: '12px'}}>
                                    Разрешены: буквы, цифры, пробел, . , / -
                                </small>
                            </div>
                            <div className="form-group">
                                <label>
                                    Дата доставки:
                                    <input 
                                        type="date" 
                                        value={deliveryDate} 
                                        onChange={(e) => setDeliveryDate(e.target.value)} 
                                        required 
                                        min={new Date().toISOString().split("T")[0]}
                                        disabled={isSubmitting}
                                    />
                                </label>
                            </div>
                            <div className="price-display">
                                <strong>Цена: {price.toFixed(2)} руб.</strong> 
                            </div>
                            <div className="form-actions">
                                <button 
                                    type="submit" 
                                    className="save-btn"
                                    disabled={isSubmitting || !address || !volume || !deliveryDate}
                                >
                                    {isSubmitting ? 'Отправка...' : 'Отправить заказ'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrderForm;