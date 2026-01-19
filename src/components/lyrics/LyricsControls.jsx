import React from 'react';
import PropTypes from 'prop-types';

const LyricsControls = ({
    linesPerPage,
    setLinesPerPage,
    highlightColor,
    setHighlightColor,
    fontSize,
    setFontSize
}) => {
    const containerStyle = {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: '12px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: 'white',
        width: 'fit-content'
    };

    const sectionStyle = {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    };

    const labelStyle = {
        fontSize: '12px',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        opacity: 0.7
    };

    const buttonGroupStyle = {
        display: 'flex',
        gap: '8px'
    };

    const buttonStyle = (isActive, color = null) => ({
        padding: '6px 12px',
        borderRadius: '6px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        backgroundColor: isActive ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
        color: 'white',
        cursor: 'pointer',
        fontSize: '14px',
        transition: 'all 0.2s',
        ...(color && { backgroundColor: color, border: isActive ? '2px solid white' : '1px solid transparent' })
    });

    const colors = [
        { name: 'Green', value: '#7CB87C' },
        { name: 'Purple', value: '#9B7CB8' },
        { name: 'Yellow', value: '#C9B857' }
    ];

    const fontSizes = [
        { label: 'S', value: 24 },
        { label: 'M', value: 32 },
        { label: 'L', value: 40 },
        { label: 'XL', value: 48 }
    ];

    return (
        <div style={containerStyle}>
            {/* Lines Per Page */}
            <div style={sectionStyle}>
                <span style={labelStyle}>Lines Per Page</span>
                <div style={buttonGroupStyle}>
                    {[2, 3, 4].map(num => (
                        <button
                            key={num}
                            style={buttonStyle(linesPerPage === num)}
                            onClick={() => setLinesPerPage(num)}
                        >
                            {num}
                        </button>
                    ))}
                </div>
            </div>

            {/* Highlight Color */}
            <div style={sectionStyle}>
                <span style={labelStyle}>Highlight Color</span>
                <div style={buttonGroupStyle}>
                    {colors.map(c => (
                        <button
                            key={c.name}
                            style={{
                                ...buttonStyle(highlightColor === c.value, c.value),
                                width: '32px',
                                height: '32px',
                                padding: 0
                            }}
                            onClick={() => setHighlightColor(c.value)}
                            title={c.name}
                        />
                    ))}
                </div>
            </div>

            {/* Font Size */}
            <div style={sectionStyle}>
                <span style={labelStyle}>Font Size</span>
                <div style={buttonGroupStyle}>
                    {fontSizes.map(fs => (
                        <button
                            key={fs.label}
                            style={buttonStyle(fontSize === fs.value)}
                            onClick={() => setFontSize(fs.value)}
                        >
                            {fs.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

LyricsControls.propTypes = {
    linesPerPage: PropTypes.number.isRequired,
    setLinesPerPage: PropTypes.func.isRequired,
    highlightColor: PropTypes.string.isRequired,
    setHighlightColor: PropTypes.func.isRequired,
    fontSize: PropTypes.number.isRequired,
    setFontSize: PropTypes.func.isRequired
};

export default LyricsControls;
